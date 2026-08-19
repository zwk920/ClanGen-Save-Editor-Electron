import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildFamilyGraph, type FamilyEdgeKind } from '../model/familyGraph';
import { afterlifeStateForCat, isDeadCat } from '../model/afterlife';
import { CatPreview } from './CatPreview';

type Cat = Record<string, any>;

interface FamilyTreeProps {
  cats: Cat[];
  selectedCatId: string | null;
  focusSelectedCat?: boolean;
  focusCatId?: string | null;
  allowShowAll?: boolean;
  onDoubleClickCat?: (catId: string) => void;
  onSelectCat: (catId: string) => void;
  displayCatLabel: (catId: string) => string;
  roleForCat: (catId: string) => string | null;
  specialConditionForCat: (cat: Cat) => string | null;
  poseForCat: (cat: Cat) => string | undefined;
  isDeadCat: (cat: Cat) => boolean;
}

const nodeWidth = 220;
const nodeHeight = 150;
const columnGap = 60;
const rowGap = 20;
const canvasPadding = 40;
const deadCatStateOrder = ['starclan', 'unknown_residence', 'dark_forest'];

const ageGroupForMoons = (moonsValue: unknown): string => {
  const moons = Number(moonsValue);
  if (!Number.isFinite(moons) || moons <= 0) return 'Newborn';
  if (moons < 6) return 'Kitten';
  if (moons < 12) return 'Adolescent';
  if (moons < 120) return 'Adult';
  return 'Senior';
};

const edgeStyle: Record<FamilyEdgeKind, { stroke: string; dash?: string; label: string }> = {
  parent: { stroke: '#536dfe', label: 'Biological parent' },
  adoptive: { stroke: '#00897b', dash: '8 5', label: 'Adoptive parent' },
  mate: { stroke: '#d84315', dash: '3 5', label: 'Mate' },
};

export function FamilyTree({ cats, selectedCatId, focusSelectedCat = false, focusCatId = null, allowShowAll = true, onDoubleClickCat, onSelectCat, displayCatLabel, roleForCat, specialConditionForCat, poseForCat, isDeadCat }: FamilyTreeProps): JSX.Element {
  const [focusedCatId, setFocusedCatId] = useState<string | null>(focusCatId ?? (focusSelectedCat ? selectedCatId : null));
  const graph = useMemo(() => buildFamilyGraph(cats, focusedCatId), [cats, focusedCatId]);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const layout = useMemo(() => {
    const positions = new Map(graph.nodes.map((node) => [node.id, {
      x: canvasPadding + node.generation * (nodeWidth + columnGap),
      y: canvasPadding + node.row * (nodeHeight + rowGap),
    }]));
    const nodesByGeneration = new Map<number, typeof graph.nodes>();
    for (const node of graph.nodes) {
      const group = nodesByGeneration.get(node.generation) ?? [];
      group.push(node);
      nodesByGeneration.set(node.generation, group);
    }
    const familyEdges = graph.edges.filter((edge) => edge.kind === 'parent' || edge.kind === 'adoptive');

    // Repeatedly pull related cards toward the average vertical position of their relatives,
    // then resolve collisions within each generation.
    for (let iteration = 0; iteration < 6; iteration += 1) {
      const nextY = new Map<string, number>();
      for (const node of graph.nodes) {
        const relatedY = familyEdges
          .filter((edge) => edge.source === node.id || edge.target === node.id)
          .map((edge) => positions.get(edge.source === node.id ? edge.target : edge.source)?.y)
          .filter((value): value is number => value !== undefined);
        const currentY = positions.get(node.id)?.y ?? canvasPadding;
        const averageY = relatedY.length > 0 ? relatedY.reduce((sum, value) => sum + value, 0) / relatedY.length : currentY;
        nextY.set(node.id, currentY * 0.35 + averageY * 0.65);
      }
      for (const [generation, nodes] of nodesByGeneration) {
        const ordered = [...nodes].sort((a, b) => b.connectionCount - a.connectionCount
          || ((a.connectionCount === 0 && b.connectionCount === 0 && isDeadCat(a.cat) && isDeadCat(b.cat))
            ? deadCatStateOrder.indexOf(afterlifeStateForCat(a.cat)) - deadCatStateOrder.indexOf(afterlifeStateForCat(b.cat))
            : 0)
          || ((a.connectionCount === 0 && b.connectionCount === 0) ? Number(isDeadCat(a.cat)) - Number(isDeadCat(b.cat)) : 0)
          || (nextY.get(a.id) ?? 0) - (nextY.get(b.id) ?? 0));
        let previousY = canvasPadding - nodeHeight - rowGap;
        for (const node of ordered) {
          const y = Math.max(nextY.get(node.id) ?? canvasPadding, previousY + nodeHeight + rowGap);
          positions.set(node.id, { x: canvasPadding + generation * (nodeWidth + columnGap), y });
          previousY = y;
        }
      }
    }

    const mateIdsFor = (id: string) => graph.edges
      .filter((edge) => edge.kind === 'mate' && (edge.source === id || edge.target === id))
      .map((edge) => edge.source === id ? edge.target : edge.source);
    const mateStep = nodeHeight + rowGap;
    const mateGenerations = new Set<number>();
    for (const node of graph.nodes) {
      const mateIds = mateIdsFor(node.id);
      const mates = mateIds
        .map((id) => graph.nodes.find((mate) => mate.id === id))
        .filter((mate): mate is typeof node => mate !== undefined);
      if (mates.length !== 2 || mates.some((mate) => mate.generation !== node.generation)) continue;
      const nodePosition = positions.get(node.id);
      if (!nodePosition) continue;
      mateGenerations.add(node.generation);
      const orderedMates = mates.sort((a, b) => (positions.get(a.id)?.y ?? 0) - (positions.get(b.id)?.y ?? 0));
      const above = positions.get(orderedMates[0].id);
      const below = positions.get(orderedMates[1].id);
      if (!above || !below) continue;
      positions.set(orderedMates[0].id, { ...above, y: nodePosition.y - mateStep });
      positions.set(orderedMates[1].id, { ...below, y: nodePosition.y + mateStep });
    }

    for (const [generation, nodes] of nodesByGeneration) {
      const ordered = [...nodes].sort((a, b) => (positions.get(a.id)?.y ?? 0) - (positions.get(b.id)?.y ?? 0));
      let previousY = canvasPadding - nodeHeight - rowGap;
      for (const node of ordered) {
        const position = positions.get(node.id);
        const y = Math.max(position?.y ?? canvasPadding, previousY + nodeHeight + rowGap);
        positions.set(node.id, { x: canvasPadding + generation * (nodeWidth + columnGap), y });
        previousY = y;
      }
    }

    for (const generation of mateGenerations) {
      const nodes = nodesByGeneration.get(generation) ?? [];
      const ordered = [...nodes].sort((a, b) => (positions.get(a.id)?.y ?? 0) - (positions.get(b.id)?.y ?? 0));
      if (ordered.length === 0) continue;
      const startY = positions.get(ordered[0].id)?.y ?? canvasPadding;
      ordered.forEach((node, index) => {
        positions.set(node.id, { x: canvasPadding + generation * (nodeWidth + columnGap), y: startY + index * mateStep });
      });
    }

    const height = Math.max(graph.height, ...[...positions.values()].map(({ y }) => y + nodeHeight + canvasPadding));
    return { positions, height };
  }, [graph]);
  const nodePositions = layout.positions;

  useEffect(() => {
    if (focusSelectedCat) setFocusedCatId(selectedCatId);
  }, [focusSelectedCat, selectedCatId]);

  useEffect(() => {
    if (focusCatId) setFocusedCatId(focusCatId);
  }, [focusCatId]);

  useEffect(() => {
    if (!focusedCatId) return;
    nodeRefs.current.get(focusedCatId)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [focusedCatId, graph.nodes]);

  if (cats.length === 0) return <Alert severity="info">Load a clan save to view the family tree.</Alert>;

  return (
    <Box sx={{ display: 'grid', gap: 2, minHeight: 0 }}>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
          <Typography variant="h5">Family tree</Typography>
          {allowShowAll && focusedCatId && <Button size="small" variant="outlined" onClick={() => setFocusedCatId(null)}>Show all cats</Button>}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Parents flow from left to right. Click a portrait to select it and focus its family.
          {focusedCatId && ` Showing the family connected to ${displayCatLabel(focusedCatId)}.`}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {(Object.entries(edgeStyle) as [FamilyEdgeKind, typeof edgeStyle[FamilyEdgeKind]][]).map(([kind, style]) => (
            <Chip key={kind} size="small" variant="outlined" label={style.label} sx={{ borderColor: style.stroke, color: style.stroke }} />
          ))}
        </Stack>
      </Paper>
      <Box sx={{ minHeight: 0, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
        <Box sx={{ position: 'relative', width: graph.width, height: layout.height }}>
          <svg aria-hidden="true" width={graph.width} height={layout.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {graph.edges.map((edge) => {
              const source = nodePositions.get(edge.source);
              const target = nodePositions.get(edge.target);
              if (!source || !target) return null;
              const style = edgeStyle[edge.kind];
              if (edge.kind === 'mate') {
                const sourceAboveTarget = source.y <= target.y;
                const sourceX = source.x + nodeWidth / 2;
                const targetX = target.x + nodeWidth / 2;
                const sourceY = sourceAboveTarget ? source.y + nodeHeight : source.y;
                const targetY = sourceAboveTarget ? target.y : target.y + nodeHeight;
                const direction = sourceAboveTarget ? 1 : -1;
                const bend = Math.max(30, Math.abs(targetY - sourceY) / 2);
                return (
                  <g key={`${edge.kind}-${edge.source}-${edge.target}`}>
                    <path d={`M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + direction * bend}, ${targetX} ${targetY - direction * bend}, ${targetX} ${targetY}`} fill="none" stroke={style.stroke} strokeWidth="2" strokeDasharray={style.dash} opacity={0.8} />
                    <circle cx={sourceX} cy={sourceY} r="5" fill={style.stroke} />
                    <circle cx={targetX} cy={targetY} r="5" fill={style.stroke} />
                  </g>
                );
              }
              const sourceX = source.x + nodeWidth;
              const sourceY = source.y + nodeHeight / 2;
              const targetX = target.x;
              const targetY = target.y + nodeHeight / 2;
              const bend = Math.max(30, (targetX - sourceX) / 2);
              return <path key={`${edge.kind}-${edge.source}-${edge.target}`} d={`M ${sourceX} ${sourceY} C ${sourceX + bend} ${sourceY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`} fill="none" stroke={style.stroke} strokeWidth="2" strokeDasharray={style.dash} opacity={0.8} />;
            })}
          </svg>
          {graph.nodes.map((node) => {
            const position = nodePositions.get(node.id)!;
            const role = roleForCat(node.id);
            const dead = isDeadCat(node.cat);
            const specialCondition = specialConditionForCat(node.cat);
            return (
              <Paper
                key={node.id}
                component="button"
                type="button"
                ref={(element: HTMLButtonElement | null) => {
                  if (element) nodeRefs.current.set(node.id, element);
                  else nodeRefs.current.delete(node.id);
                }}
                onClick={() => {
                  setFocusedCatId(node.id);
                  onSelectCat(node.id);
                }}
                onDoubleClick={() => onDoubleClickCat?.(node.id)}
                variant="outlined"
                sx={{
                  position: 'absolute', left: position.x, top: position.y, width: nodeWidth, height: nodeHeight,
                  p: 1, textAlign: 'left', cursor: 'pointer', color: 'inherit',
                  border: selectedCatId === node.id ? 2 : 1,
                  borderColor: selectedCatId === node.id ? 'primary.main' : dead ? 'error.main' : 'divider',
                  bgcolor: selectedCatId === node.id ? 'action.selected' : 'background.paper',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
                  <CatPreview cat={node.cat} poseName={poseForCat(node.cat)} size={84} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>{displayCatLabel(node.id)}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {ageGroupForMoons(node.cat.moons)}
                    </Typography>
                    {role && <Chip label={role} size="small" color="primary" sx={{ mt: 1, maxWidth: '100%' }} />}
                    {!role && specialCondition && specialCondition !== 'Kitten' && <Chip label={specialCondition} size="small" variant="outlined" sx={{ mt: 1, maxWidth: '100%' }} />}
                    {dead && <Chip label="Dead" size="small" color="error" sx={{ mt: 1, maxWidth: '100%' }} />}
                  </Box>
                </Stack>
              </Paper>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}