import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const GAP_PX = 16;

interface MediaCarouselProps {
  children: React.ReactNode[];
  /** How many items fit in the viewport at once when not using `responsive`. */
  visibleSlots?: number;
  /** Fixed height of the track area; width fills the parent. */
  trackHeight?: number;
  /** When true, `visibleSlots` is the max; column count follows container width and `minItemWidth`. */
  responsive?: boolean;
  /** Minimum width (px) per slide when `responsive` is true. */
  minItemWidth?: number;
}

function slideBasisCss(visibleSlots: number): string {
  const gapsBetweenVisible = Math.max(0, visibleSlots - 1) * GAP_PX;
  return `calc((100% - ${gapsBetweenVisible}px) / ${visibleSlots})`;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({
  children,
  visibleSlots = 3,
  trackHeight = 200,
  responsive = false,
  minItemWidth = 130,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [dynSlots, setDynSlots] = useState(visibleSlots);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const items = React.Children.toArray(children).filter(Boolean);
  const slots = responsive ? Math.max(2, Math.min(visibleSlots, dynSlots)) : visibleSlots;
  const showNavButtons = items.length > slots;
  const basis = slideBasisCss(slots);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanPrev(scrollLeft > 4);
    setCanNext(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (!responsive) {
      setDynSlots(visibleSlots);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const calc = () => {
      const w = el.clientWidth;
      const n = Math.floor((w + GAP_PX) / (minItemWidth + GAP_PX));
      setDynSlots(Math.max(2, Math.min(visibleSlots, n || 2)));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, visibleSlots, minItemWidth, items.length]);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [items.length, updateArrows, slots]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | undefined;
    const step = first ? first.getBoundingClientRect().width + GAP_PX : (el.clientWidth / slots) * 0.95;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  if (items.length === 0) {
    return null;
  }

  const navBtnStyle = (side: 'left' | 'right', disabled: boolean): React.CSSProperties => ({
    position: 'absolute',
    [side]: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 3,
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(7,8,10,0.88)',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    display: 'grid',
    placeItems: 'center',
  });

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        height: trackHeight,
        maxHeight: trackHeight,
        boxSizing: 'border-box',
      }}
    >
      {showNavButtons && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            style={navBtnStyle('left', !canPrev)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            style={navBtnStyle('right', !canNext)}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
      <div
        ref={scrollerRef}
        className="media-carousel-track"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: GAP_PX,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 4,
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          scrollSnapType: 'x mandatory',
          cursor: 'grab',
          WebkitOverflowScrolling: 'touch',
        }}
        onMouseDown={(e) => {
          const el = scrollerRef.current;
          if (!el) return;
          const startX = e.pageX + el.scrollLeft;
          const onMove = (ev: MouseEvent) => {
            el.scrollLeft = startX - ev.pageX;
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            el.style.cursor = 'grab';
          };
          el.style.cursor = 'grabbing';
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      >
        {items.map((child, i) => (
          <div
            key={i}
            style={{
              flex: `0 0 ${basis}`,
              width: basis,
              minWidth: 0,
              maxHeight: '100%',
              scrollSnapAlign: 'start',
              boxSizing: 'border-box',
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaCarousel;
