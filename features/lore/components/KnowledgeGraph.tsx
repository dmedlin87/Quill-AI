import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '@/features/project';
import type { CharacterProfile } from '@/types';

interface KnowledgeGraphProps {
  onSelectCharacter: (character: CharacterProfile) => void;
}

type CharacterRelationship = NonNullable<CharacterProfile['relationships']>[number];

interface GraphLink {
  source: string;
  target: string;
  type?: string;
  dynamic?: string;
}

interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  character: CharacterProfile;
}

type LegendNode = Pick<GraphNode, 'id' | 'name' | 'color'>;

interface ChapterSummary {
  lastAnalysis?: {
    characters?: CharacterProfile[];
  };
}

interface Dimensions {
  width: number;
  height: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const COLORS: readonly string[] = [
  'var(--magic-400)',
  'var(--success-400)',
  'var(--warning-400)',
  'var(--error-400)',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ onSelectCharacter }) => {
  const { currentProject, chapters: projectChapters } = useProjectStore();
  const chapters: ChapterSummary[] = projectChapters ?? [];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const selectedNodeRef = useRef<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 800, height: 600 });

  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({
    node: null,
    offsetX: 0,
    offsetY: 0,
  });

  /**
   * Collect and deduplicate characters from lore and chapter analyses.
   * Maintains stable order so colors remain consistent when data is unchanged.
   */
  const characters = useMemo<CharacterProfile[]>(() => {
    const characterMap = new Map<string, CharacterProfile>();

    currentProject?.lore?.characters?.forEach((char) => {
      characterMap.set(char.name.toLowerCase(), char);
    });

    chapters.forEach((chapter) => {
      chapter.lastAnalysis?.characters?.forEach((char) => {
        const key = char.name.toLowerCase();
        if (!characterMap.has(key)) {
          characterMap.set(key, char);
        }
      });
    });

    return Array.from(characterMap.values());
  }, [currentProject, chapters]);

  /**
   * Derive graph nodes and links from character data and canvas dimensions.
   */
  const graphData = useMemo<GraphData>(() => {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const nodes = characters.map((char, i) => ({
      id: char.name.toLowerCase(),
      name: char.name,
      x: centerX + (Math.random() - 0.5) * 300,
      y: centerY + (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
      radius: Math.min(30, 20 + (char.relationships?.length || 0) * 3),
      color: COLORS[i % COLORS.length],
      character: char,
    }));

    const links: GraphLink[] = [];
    const nodeIds = new Set(nodes.map((node) => node.id));

    characters.forEach((char) => {
      char.relationships?.forEach((rel: CharacterRelationship) => {
        const targetId = rel.name.toLowerCase();
        if (nodeIds.has(targetId)) {
          const existing = links.find(
            (l) =>
              (l.source === char.name.toLowerCase() && l.target === targetId) ||
              (l.source === targetId && l.target === char.name.toLowerCase()),
          );

          if (!existing) {
            links.push({
              source: char.name.toLowerCase(),
              target: targetId,
              type: rel.type,
              dynamic: rel.dynamic,
            });
          }
        }
      });
    });

    return { nodes, links };
  }, [characters, dimensions]);

  const legendNodes = useMemo<LegendNode[]>(
    () => graphData.nodes.map(({ id, name, color }) => ({ id, name, color })),
    [graphData.nodes],
  );

  useEffect(() => {
    nodesRef.current = graphData.nodes.map((node) => ({ ...node }));
    linksRef.current = graphData.links.map((link) => ({ ...link }));
    hoveredNodeRef.current = null;
    selectedNodeRef.current = null;
    dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
  }, [graphData]);

  const handleResize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    setDimensions((prev) =>
      prev.width === rect.width && prev.height === rect.height
        ? prev
        : { width: rect.width, height: rect.height },
    );
  }, []);

  const attachResizeObserver = useCallback(
    (target: Element | null): ResizeObserver | null => {
      if (typeof ResizeObserver !== 'function' || !target) {
        return null;
      }

      try {
        const observer = new ResizeObserver(handleResize);
        observer.observe(target);
        return observer;
      } catch {
        return null;
      }
    },
    [handleResize],
  );

  useEffect(() => {
    handleResize();

    const observer = attachResizeObserver(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [attachResizeObserver, handleResize]);

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    nodes.forEach((node) => {
      node.vx += (centerX - node.x) * 0.001;
      node.vy += (centerY - node.y) * 0.001;

      nodes.forEach((other) => {
        if (other.id !== node.id) {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = node.radius + other.radius + 80;

          if (dist < minDist) {
            const force = ((minDist - dist) / dist) * 0.5;
            node.vx += dx * force;
            node.vy += dy * force;
          }
        }
      });
    });

    links.forEach((link) => {
      const source = nodes.find((n) => n.id === link.source);
      const target = nodes.find((n) => n.id === link.target);
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = 150;
        const force = ((dist - idealDist) / dist) * 0.02;

        source.vx += dx * force;
        source.vy += dy * force;
        target.vx -= dx * force;
        target.vy -= dy * force;
      }
    });

    nodes.forEach((node) => {
      if (dragRef.current.node?.id !== node.id) {
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;

        const padding = 60;
        node.x = Math.max(padding, Math.min(dimensions.width - padding, node.x));
        node.y = Math.max(padding, Math.min(dimensions.height - padding, node.y));
      }
    });
  }, [dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodesRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      simulate();

      ctx.fillStyle = 'rgba(252, 250, 245, 1)';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      linksRef.current.forEach((link) => {
        const source = nodesRef.current.find((n) => n.id === link.source);
        const target = nodesRef.current.find((n) => n.id === link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          const isHovered =
            hoveredNodeRef.current &&
            (hoveredNodeRef.current.id === source.id || hoveredNodeRef.current.id === target.id);

          ctx.strokeStyle = isHovered ? 'rgba(139, 92, 246, 0.6)' : 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = isHovered ? 2 : 1;
          ctx.stroke();

          if (
            hoveredNodeRef.current &&
            (hoveredNodeRef.current.id === source.id || hoveredNodeRef.current.id === target.id)
          ) {
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.font = '10px sans-serif';
            ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
            ctx.textAlign = 'center';

            ctx.fillText(link.type, midX, midY - 4);
          }
        }
      });

      nodesRef.current.forEach((node) => {
        const isHovered = hoveredNodeRef.current?.id === node.id;
        const isSelected = selectedNodeRef.current?.id === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isHovered ? 4 : 0), 0, Math.PI * 2);

        const gradient = ctx.createRadialGradient(
          node.x - node.radius * 0.3,
          node.y - node.radius * 0.3,
          0,
          node.x,
          node.y,
          node.radius,
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(1, node.color);

        ctx.fillStyle = gradient;
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.strokeStyle = isSelected ? '#1a1a1a' : 'rgba(0,0,0,0.3)';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();
        }

        ctx.font = `${isHovered ? 'bold ' : ''}12px "Crimson Pro", serif`;
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const maxWidth = node.radius * 1.8;
        let displayName = node.name;
        if (ctx.measureText(displayName).width > maxWidth) {
          while (ctx.measureText(`${displayName}...`).width > maxWidth && displayName.length > 0) {
            displayName = displayName.slice(0, -1);
          }
          displayName += '...';
        }

        ctx.fillText(displayName, node.x, node.y + node.radius + 16);
      });


      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [dimensions, graphData, simulate]);

  const getNodeAtPosition = useCallback((x: number, y: number): GraphNode | null => {
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius) {
        return node;
      }
    }
    return null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (dragRef.current.node) {
        dragRef.current.node.x = x - dragRef.current.offsetX;
        dragRef.current.node.y = y - dragRef.current.offsetY;
        dragRef.current.node.vx = 0;
        dragRef.current.node.vy = 0;
        return;
      }

      const node = getNodeAtPosition(x, y);
      hoveredNodeRef.current = node;

      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'pointer' : 'default';
      }
    },
    [getNodeAtPosition],
  );


  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = getNodeAtPosition(x, y);

      if (node) {
        dragRef.current = {
          node,
          offsetX: x - node.x,
          offsetY: y - node.y,
        };
      }
    },
    [getNodeAtPosition],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.node) {
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = getNodeAtPosition(x, y);

      if (node) {
        selectedNodeRef.current = node;
        onSelectCharacter(node.character);
      } else {
        selectedNodeRef.current = null;
      }
    },
    [getNodeAtPosition, onSelectCharacter],
  );

  if (characters.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--parchment-200)] flex items-center justify-center mb-4">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--ink-400)]"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h3 className="font-serif text-lg font-semibold text-[var(--ink-700)] mb-2">No Characters Found</h3>
        <p className="text-sm text-[var(--ink-500)] max-w-xs">
          Run analysis on your chapters or add characters to the Lore Bible to see them visualized here.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        className="block"
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-[var(--parchment-50)] rounded-lg border border-[var(--ink-100)] p-3 shadow-sm">
        <div className="text-xs font-semibold text-[var(--ink-600)] mb-2">Characters</div>
        <div className="space-y-1">
          {legendNodes.slice(0, 5).map((node) => (
            <div key={node.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: node.color }} />
              <span className="text-xs text-[var(--ink-600)]">{node.name}</span>
            </div>
          ))}
          {legendNodes.length > 5 && (
            <div className="text-xs text-[var(--ink-400)]">+{legendNodes.length - 5} more</div>
          )}
        </div>
      </div>
    </div>
  );
};