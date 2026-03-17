import React, { useState, useEffect } from 'react';
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import Cookies from 'js-cookie';
import { toPng } from 'html-to-image';
import mapsData from './data/maps.json';

// Types
interface MapItem {
  id: string;
  name: string;
  imageUrl: string;
}

interface Tier {
  id: string;
  name: string;
  color: string;
  items: MapItem[];
}

// Initial grouping colors
const DEFAULT_TIER_COLORS = [
  'bg-cyan-500',
  'bg-cyan-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-yellow-500',
  'bg-yellow-500',
  'bg-yellow-500',
  'bg-yellow-500',
  'bg-fuchsia-500',
  'bg-fuchsia-500',
  'bg-fuchsia-500',
  'bg-fuchsia-500',
  'bg-red-500',
  'bg-red-500',
  'bg-red-500',
];

// Rich palette for customization
const COLOR_PALETTE = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500',
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500', 'bg-slate-500', 'bg-zinc-500', 'bg-neutral-500'
];

const INITIAL_TIERS: Tier[] = Array.from({ length: 15 }, (_, i) => ({
  id: `tier-${Date.now()}-${i}`,
  name: `${i + 1}`,
  color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
  items: [],
}));

export default function App() {
  // Safe JSON parse for cookes
  const getSavedState = () => {
    // return null;
    const saved = Cookies.get('jumpking-tierlist');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
    return null;
  };

  const savedState = getSavedState();

  const [author, setAuthor] = useState(savedState?.author || '');
  const [tiers, setTiers] = useState<Tier[]>(savedState?.tiers || INITIAL_TIERS);
  const [unranked, setUnranked] = useState<MapItem[]>(savedState?.unranked || mapsData);
  const [activeItem, setActiveItem] = useState<MapItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Save to cookies
  useEffect(() => {
    Cookies.set('jumpking-tierlist', JSON.stringify({ author, tiers, unranked }), { expires: 30 });
  }, [author, tiers, unranked]);

  function findContainer(id: string) {
    if (id === 'unranked') return 'unranked';
    if (unranked.some(item => item.id === id)) return 'unranked';
    const tier = tiers.find(t => t.id === id || t.items.some(item => item.id === id));
    return tier ? tier.id : null;
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    const item = unranked.find(i => i.id === id) || tiers.flatMap(t => t.items).find(i => i.id === id);
    if (item) setActiveItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setTiers((prev: Tier[]) => {
      const activeTierObj = prev.find(t => t.id === activeContainer);
      const movedItem = activeTierObj?.items.find(i => i.id === activeId) || unranked.find(i => i.id === activeId);

      if (!movedItem) return prev;

      return prev.map(tier => {
        if (tier.id === activeContainer) {
          return { ...tier, items: tier.items.filter(i => i.id !== activeId) };
        }
        if (tier.id === overContainer) {
          return { ...tier, items: [...tier.items, movedItem] };
        }
        return tier;
      });
    });

    if (activeContainer === 'unranked') {
      setUnranked(prev => prev.filter(i => i.id !== activeId));
    }
    if (overContainer === 'unranked') {
      const item = tiers.find(t => t.id === activeContainer)?.items.find(i => i.id === activeId) || unranked.find(i => i.id === activeId);
      if (item) setUnranked(prev => [...prev, item]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveItem(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (activeContainer && overContainer) {
      if (activeContainer === overContainer) {
        if (activeId !== overId) {
          if (activeContainer === 'unranked') {
            setUnranked(prev => {
              const oldIndex = prev.findIndex(i => i.id === activeId);
              const newIndex = prev.findIndex(i => i.id === overId);
              return arrayMove(prev, oldIndex, newIndex);
            });
          } else {
            setTiers(prev => prev.map(t => {
              if (t.id === activeContainer) {
                const oldIndex = t.items.findIndex(i => i.id === activeId);
                const newIndex = t.items.findIndex(i => i.id === overId);
                return { ...t, items: arrayMove(t.items, oldIndex, newIndex) };
              }
              return t;
            }));
          }
        }
      }
    }

    setActiveItem(null);
  };

  const addTier = () => {
    const newTier: Tier = {
      id: `tier-${Date.now()}`,
      name: 'NEW',
      color: COLOR_PALETTE[tiers.length % COLOR_PALETTE.length],
      items: [],
    };
    setTiers(prev => [...prev, newTier]);
  };

  const deleteTier = (id: string) => {
    const tierToDelete = tiers.find(t => t.id === id);
    if (tierToDelete) {
      setUnranked(prev => [...prev, ...tierToDelete.items]);
      setTiers(prev => prev.filter(t => t.id !== id));
    }
  };

  const moveTier = (id: string, direction: 'up' | 'down') => {
    const index = tiers.findIndex(t => t.id === id);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tiers.length) return;
    setTiers(prev => arrayMove(prev, index, newIndex));
  };

  const updateTierColor = (id: string) => {
    setTiers(prev => prev.map(t => {
      if (t.id === id) {
        const currentColorIndex = COLOR_PALETTE.indexOf(t.color);
        const nextColorIndex = (currentColorIndex + 1) % COLOR_PALETTE.length;
        return { ...t, color: COLOR_PALETTE[nextColorIndex] };
      }
      return t;
    }));
  };

  const resetState = () => {
    if (window.confirm('Are you sure you want to reset all data? This will clear your current tier list and creator name.')) {
      Cookies.remove('jumpking-tierlist');
      setAuthor('');
      setTiers(INITIAL_TIERS);
      setUnranked(mapsData);
    }
  };

  const downloadImage = () => {
    const node = document.getElementById('tier-list-container');
    if (node) {
      toPng(node, { cacheBust: true, backgroundColor: '#0f172a' })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `jumpking-tierlist-${author || 'anonymous'}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('oops, something went wrong!', err);
        });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 p-8">
      <header className="max-w-6xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <h1 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-sm">
            JUMP KING TIERLIST
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Creator</span>
            <input
              type="text"
              placeholder="Your Name"
              value={author}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuthor(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 no-export-btn">
          <a
            href="https://github.com/YutaGoto/jumpking-custom-maps-tierlist"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700/50 transition-all flex items-center justify-center group/github"
            title="View on GitHub"
          >
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
          <button
            onClick={resetState}
            className="bg-slate-900/50 hover:bg-red-900/40 text-slate-400 hover:text-red-400 font-bold py-4 px-6 rounded-xl border border-slate-700/50 hover:border-red-900/50 transition-all flex items-center gap-2 uppercase tracking-tight text-sm group/reset"
          >
            <svg className="w-4 h-4 transition-transform group-hover/reset:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
          <button
            onClick={addTier}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-xl border border-slate-700 transition-all flex items-center gap-2 uppercase tracking-tight text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            Add Tier
          </button>
          <button
            onClick={downloadImage}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-xl shadow-2xl shadow-blue-900/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 uppercase tracking-tight"
          >
            <span>Save as Image</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          <div id="tier-list-container" className="bg-[#020617] p-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="flex flex-col gap-1">
              {tiers.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  setTiers={setTiers}
                  onDelete={() => deleteTier(tier.id)}
                  onMove={(dir) => moveTier(tier.id, dir)}
                  onColorChange={() => updateTierColor(tier.id)}
                />
              ))}
            </div>
            {author && (
              <div className="px-6 py-4 bg-slate-900/80 border-t border-slate-800 flex justify-end">
                <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">
                  Created by <span className="text-blue-400 ml-1">{author}</span>
                </p>
              </div>
            )}
          </div>

          <UnrankedArea unranked={unranked} />

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
            {activeItem ? <MapThumb item={activeItem} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      <footer className="mt-20 text-center">
         <p className="text-slate-600 font-bold uppercase text-[10px] tracking-[0.5em]">Jump King Custom Maps &bull; Tierlist Creator</p>
      </footer>

      <style>{`
        .no-export { display: none !important; }
        .group:hover .no-export { display: flex !important; }
        @media print { .no-export-btn { display: none; } }
      `}</style>
    </div>
  );
}

function TierRow({ tier, setTiers, onDelete, onMove, onColorChange }: {
  tier: Tier,
  setTiers: React.Dispatch<React.SetStateAction<Tier[]>>,
  onDelete: () => void,
  onMove: (dir: 'up' | 'down') => void,
  onColorChange: () => void
}) {
  const { setNodeRef } = useDroppable({ id: tier.id });

  return (
    <div className="flex min-h-[50px] group relative">
      <div className={`${tier.color} w-28 flex-shrink-0 flex items-center justify-center p-2 border-r border-slate-900/20`}>
        <input
          type="text"
          value={tier.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const newName = e.target.value;
            setTiers((prev: Tier[]) => prev.map((t: Tier) => t.id === tier.id ? { ...t, name: newName } : t));
          }}
          className="bg-transparent border-none text-center w-full focus:outline-none font-black text-base text-slate-950 uppercase leading-tight"
        />
      </div>
      <div
        ref={setNodeRef}
        className="flex-grow p-2 bg-slate-900/30 flex flex-wrap gap-2 items-start min-h-[40px] pr-12"
      >
        <SortableContext items={tier.items.map(i => i.id)} strategy={horizontalListSortingStrategy}>
          {tier.items.map((item: MapItem) => (
            <MapThumb key={item.id} item={item} />
          ))}
        </SortableContext>
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 no-export z-10 bg-slate-800/80 p-1 rounded-md backdrop-blur-sm shadow-xl border border-slate-700">
        <button onClick={() => onMove('up')} className="hover:text-blue-400 p-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></button>
        <button onClick={onColorChange} className="hover:text-yellow-400 p-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg></button>
        <button onClick={onDelete} className="hover:text-red-400 p-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        <button onClick={() => onMove('down')} className="hover:text-blue-400 p-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></button>
      </div>
    </div>
  );
}

function UnrankedArea({ unranked }: { unranked: MapItem[] }) {
  const { setNodeRef } = useDroppable({ id: 'unranked' });

  return (
    <div className="mt-2 bg-slate-900/50 p-8 rounded-2xl border border-slate-800/50 backdrop-blur-sm">
      <h2 className="text-slate-500 font-black uppercase text-xs tracking-[0.3em] mb-8">Available Maps</h2>
      <div
        ref={setNodeRef}
        id="unranked"
        className="flex flex-wrap gap-4 min-h-[40px]"
      >
        <SortableContext items={unranked.map(i => i.id)} strategy={horizontalListSortingStrategy}>
          {unranked.map((item: MapItem) => (
            <MapThumb key={item.id} item={item} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function MapThumb({ item, isOverlay }: { item: MapItem, isOverlay?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isOverlay ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative w-16 h-12 rounded-md overflow-hidden border border-slate-800 hover:border-blue-500 transition-all cursor-grab active:cursor-grabbing group shadow-md ${isOverlay ? 'scale-110 shadow-2xl border-blue-400 rotate-2' : ''}`}
    >
      {!imgError ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          crossOrigin="anonymous"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center p-1">
          <span className="text-[10px] font-black text-slate-500 text-center uppercase leading-none break-all">
            {item.name}
          </span>
        </div>
      )}
      <div className={`absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent flex items-end p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOverlay ? 'opacity-100' : ''}`}>
        <span className="text-[8px] font-bold leading-none line-clamp-2 text-white drop-shadow-md">{item.name}</span>
      </div>
    </div>
  );
}
