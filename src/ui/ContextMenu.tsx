import { Check, type LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Đánh dấu lựa chọn đang áp dụng, ví dụ trạng thái hiện tại của vùng. */
  checked?: boolean;
  /** Thao tác xóa hoặc bỏ, hiện màu đỏ. */
  danger?: boolean;
}

export type MenuEntry = MenuItem | 'divider';

interface Props {
  /** Vị trí con trỏ, tính bằng pixel từ góc trên bên trái của khung bản đồ. */
  x: number;
  y: number;
  title?: string;
  items: MenuEntry[];
  onClose: () => void;
}

const EDGE_GAP = 4;

/**
 * Menu chuột phải trên bản đồ.
 * Menu đóng khi bấm ra ngoài, nhấn Esc, chọn một mục, hoặc khi bản đồ di chuyển.
 */
export default function ContextMenu({ x, y, title, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Menu không được tràn ra ngoài khung bản đồ. Nếu sát mép, menu lật sang phía bên kia con trỏ.
  useLayoutEffect(() => {
    const menu = ref.current;
    const parent = menu?.offsetParent as HTMLElement | null;
    if (!menu || !parent) return;
    const left = x + menu.offsetWidth + EDGE_GAP > parent.clientWidth ? Math.max(EDGE_GAP, x - menu.offsetWidth) : x;
    const top = y + menu.offsetHeight + EDGE_GAP > parent.clientHeight ? Math.max(EDGE_GAP, y - menu.offsetHeight) : y;
    setPosition({ left, top });
    menu.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      aria-label={title ?? 'Thao tác'}
      style={position}
      onContextMenu={(event) => event.preventDefault()}
    >
      {title && <div className="context-menu-title">{title}</div>}
      {items.map((item, index) => {
        if (item === 'divider') return <div key={`divider-${index}`} className="context-menu-divider" role="separator" />;
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            role="menuitemcheckbox"
            aria-checked={item.checked ?? false}
            className={`context-menu-item${item.danger ? ' is-danger' : ''}`}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <Icon size={16} aria-hidden="true" />
            {item.label}
            {item.checked && <Check size={16} className="context-menu-check" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
