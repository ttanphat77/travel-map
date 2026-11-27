import {
  BedDouble,
  Camera,
  Castle,
  Church,
  CircleDot,
  Coffee,
  FerrisWheel,
  House,
  Landmark,
  Mountain,
  Shapes,
  ShoppingBag,
  TreePalm,
  Trees,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { useId } from 'react';
import { CATEGORY_LABELS, PLACE_CATEGORIES, type PlaceCategory } from '../domain/types';
import { DEFAULT_SYMBOL_ID, HOMETOWN_SYMBOL_ID, categorySymbolId } from '../map/markers';

export const CATEGORY_ICONS: Record<PlaceCategory, LucideIcon> = {
  food: Utensils,
  cafe: Coffee,
  stay: BedDouble,
  heritage: Castle,
  museum: Landmark,
  religion: Church,
  nature: Mountain,
  beach: TreePalm,
  park: Trees,
  sightseeing: Camera,
  shopping: ShoppingBag,
  fun: FerrisWheel,
};

/**
 * Bộ biểu tượng ẩn của các loại ghim.
 * Ghim trên bản đồ là HTML do MapLibre quản lý, không nằm trong cây React.
 * Vì vậy ghim dùng lại các biểu tượng này qua thẻ <use> theo id.
 */
export function CategorySprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true" focusable="false">
      <defs>
        {PLACE_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          return (
            <symbol key={category} id={categorySymbolId(category)} viewBox="0 0 24 24">
              <Icon size={24} strokeWidth={2.5} />
            </symbol>
          );
        })}
        <symbol id={DEFAULT_SYMBOL_ID} viewBox="0 0 24 24">
          <CircleDot size={24} strokeWidth={2.5} />
        </symbol>
        <symbol id={HOMETOWN_SYMBOL_ID} viewBox="0 0 24 24">
          <House size={24} strokeWidth={2.5} />
        </symbol>
      </defs>
    </svg>
  );
}

interface ChipProps {
  category: PlaceCategory;
  /** Có thì nhãn là nút bấm. */
  onPick?: (category: PlaceCategory) => void;
}

/** Nhãn loại của một ghim, gồm biểu tượng và tên loại. */
export function CategoryChip({ category, onPick }: ChipProps) {
  const Icon = CATEGORY_ICONS[category];
  const label = CATEGORY_LABELS[category];
  const content = (
    <>
      <Icon size={13} aria-hidden="true" />
      {label}
    </>
  );
  if (!onPick) return <span className="chip">{content}</span>;
  return (
    <button type="button" className="chip chip-button" title={`Xem các ghim loại ${label}`} onClick={() => onPick(category)}>
      {content}
    </button>
  );
}

interface PickerProps {
  value: PlaceCategory | undefined;
  onChange: (category: PlaceCategory | undefined) => void;
}

/** Ô chọn loại ghim. Mỗi ghim có tối đa một loại. Bấm lại loại đang chọn thì bỏ chọn. */
export function CategoryPicker({ value, onChange }: PickerProps) {
  const labelId = useId();
  return (
    <div className="field">
      <span className="field-label" id={labelId}>
        <Shapes size={14} aria-hidden="true" />
        Loại ghim
      </span>
      <div className="category-picker" role="group" aria-labelledby={labelId}>
        {PLACE_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const active = value === category;
          return (
            <button
              key={category}
              type="button"
              className={`category-option${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(active ? undefined : category)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{CATEGORY_LABELS[category]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
