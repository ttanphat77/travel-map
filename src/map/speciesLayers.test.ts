import { describe, expect, it } from 'vitest';
import type { ActiveSpecies } from '../domain/species';
import { SPECIES_OBS_LAYER, SPECIES_RANGE_LAYER, createSpeciesLayers, type SpeciesMap } from './speciesLayers';

/**
 * Bản đồ giả. Style ban đầu có một lớp nền, một lớp màu vùng của app và hai lớp chữ.
 * Bản đồ giả ghi lại mọi lần thêm và gỡ, để test biết hàm có làm thừa việc không.
 */
function fakeMap() {
  const order = ['background', 'tm-provinces-fill', 'label_road', 'label_city'];
  const types = new Map<string, string>([
    ['background', 'background'],
    ['tm-provinces-fill', 'fill'],
    ['label_road', 'symbol'],
    ['label_city', 'symbol'],
  ]);
  const sources = new Map<string, Record<string, unknown>>();
  const visibility = new Map<string, string>();
  const log: string[] = [];
  const map = {
    getLayersOrder: () => [...order],
    getLayer: (id: string) => (types.has(id) ? { type: types.get(id) } : undefined),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: Record<string, unknown>) => {
      sources.set(id, spec);
      log.push(`addSource ${id}`);
    },
    removeSource: (id: string) => {
      sources.delete(id);
      log.push(`removeSource ${id}`);
    },
    addLayer: (layer: { id: string; type: string }, before?: string) => {
      order.splice(before ? order.indexOf(before) : order.length, 0, layer.id);
      types.set(layer.id, layer.type);
      log.push(`addLayer ${layer.id}`);
    },
    removeLayer: (id: string) => {
      order.splice(order.indexOf(id), 1);
      types.delete(id);
      log.push(`removeLayer ${id}`);
    },
    setLayoutProperty: (id: string, _name: string, value: string) => {
      visibility.set(id, value);
    },
  };
  return { map: map as unknown as SpeciesMap, order, sources, visibility, log };
}

const douc: ActiveSpecies = { inatId: 43517, gbifKey: 2436529, name: 'Chà vá chân đỏ', group: 'Mammalia', showRange: true, showObservations: true };

describe('hai lớp của loài trên bản đồ', () => {
  it('chèn hai lớp trên lớp màu vùng và dưới lớp chữ đầu tiên, vùng phân bố nằm dưới', () => {
    const { map, order, sources, visibility } = fakeMap();
    createSpeciesLayers(map).sync(douc);
    expect(order).toEqual(['background', 'tm-provinces-fill', SPECIES_RANGE_LAYER, SPECIES_OBS_LAYER, 'label_road', 'label_city']);
    expect(sources.get(SPECIES_RANGE_LAYER)).toMatchObject({
      type: 'raster',
      tiles: ['https://api.inaturalist.org/v1/taxon_ranges/43517/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 4,
    });
    expect(sources.get(SPECIES_OBS_LAYER)).toMatchObject({ type: 'raster', tileSize: 512, maxzoom: 12 });
    expect(String((sources.get(SPECIES_OBS_LAYER)?.tiles as string[])[0])).toContain('taxonKey=2436529');
    expect(visibility.get(SPECIES_RANGE_LAYER)).toBe('visible');
    expect(visibility.get(SPECIES_OBS_LAYER)).toBe('visible');
  });

  it('bật tắt một lớp mà không gỡ và thêm lại', () => {
    const { map, visibility, log } = fakeMap();
    const layers = createSpeciesLayers(map);
    layers.sync(douc);
    log.length = 0;
    layers.sync({ ...douc, showRange: false });
    expect(visibility.get(SPECIES_RANGE_LAYER)).toBe('none');
    expect(visibility.get(SPECIES_OBS_LAYER)).toBe('visible');
    expect(log).toEqual([]);
  });

  it('đổi loài thì thay cả hai lớp và giữ đúng thứ tự', () => {
    const { map, order, sources } = fakeMap();
    const layers = createSpeciesLayers(map);
    layers.sync(douc);
    layers.sync({ ...douc, inatId: 74973, gbifKey: 4262655, name: 'Sao la' });
    expect(order.indexOf(SPECIES_RANGE_LAYER)).toBeLessThan(order.indexOf(SPECIES_OBS_LAYER));
    expect(order.indexOf(SPECIES_OBS_LAYER)).toBeLessThan(order.indexOf('label_road'));
    expect((sources.get(SPECIES_RANGE_LAYER)?.tiles as string[])[0]).toContain('/74973/');
  });

  it('loài chưa có khóa GBIF chỉ có lớp vùng phân bố', () => {
    const { map, order } = fakeMap();
    createSpeciesLayers(map).sync({ ...douc, gbifKey: undefined });
    expect(order).toContain(SPECIES_RANGE_LAYER);
    expect(order).not.toContain(SPECIES_OBS_LAYER);
  });

  it('gỡ cả hai lớp và hai nguồn khi không còn loài nào', () => {
    const { map, order, sources } = fakeMap();
    const layers = createSpeciesLayers(map);
    layers.sync(douc);
    layers.sync(null);
    expect(order).toEqual(['background', 'tm-provinces-fill', 'label_road', 'label_city']);
    expect(sources.size).toBe(0);
  });
});
