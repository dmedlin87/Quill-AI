/**
 * Goal Dependency Graph (Enhancement 3D)
 * 
 * Supports hierarchical goals with parent-child relationships
 * and blocking dependencies between goals.
 */

import { AgentGoal, CreateGoalInput } from './types';
import { addGoal, getGoals, updateGoal, getGoal } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GoalNode extends AgentGoal {
  depth: number;
  children: GoalNode[];
  isBlocked: boolean;
  blockedByNames: string[];
  completionPercent: number;
  path: string[]; // IDs from root to this node
}

export interface GoalHierarchy {
  roots: GoalNode[];
  totalGoals: number;
  completedGoals: number;
  blockedGoals: number;
  overallProgress: number;
}

export interface GoalDependency {
  goalId: string;
  dependsOn: string[];
  blockedBy: string[];
}

// Extended goal input with hierarchy support
export interface HierarchicalGoalInput extends CreateGoalInput {
  parentGoalId?: string;
  blockedBy?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// GOAL CREATION WITH HIERARCHY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a goal with optional parent and dependencies
 */
export const createHierarchicalGoal = async (
  input: HierarchicalGoalInput
): Promise<AgentGoal> => {
  const { parentGoalId, blockedBy, ...baseInput } = input;
  
  // Create base goal
  const goal = await addGoal(baseInput);
  
  // Store hierarchy metadata in goal (using description field for now)
  // In a production system, you'd extend the schema
  const metadata: string[] = [];
  
  if (parentGoalId) {
    metadata.push(`parent:${parentGoalId}`);
  }
  
  if (blockedBy && blockedBy.length > 0) {
    metadata.push(`blocked_by:${blockedBy.join(',')}`);
  }
  
  if (metadata.length > 0) {
    const description = goal.description || '';
    await updateGoal(goal.id, {
      description: description + (description ? '\n' : '') + `[meta:${metadata.join('|')}]`,
    });
  }
  
  return goal;
};

/**
 * Add a subgoal to an existing goal
 */
export const addSubgoal = async (
  parentGoalId: string,
  input: CreateGoalInput
): Promise<AgentGoal> => {
  return createHierarchicalGoal({
    ...input,
    parentGoalId,
  });
};

/**
 * Add a dependency (blocker) to a goal
 */
export const addGoalDependency = async (
  goalId: string,
  blockedByGoalId: string
): Promise<void> => {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);
  
  const currentBlockers = extractBlockedBy(goal);
  if (!currentBlockers.includes(blockedByGoalId)) {
    currentBlockers.push(blockedByGoalId);
    await updateGoalMetadata(goal, { blockedBy: currentBlockers });
  }
};

/**
 * Remove a dependency from a goal
 */
export const removeGoalDependency = async (
  goalId: string,
  blockedByGoalId: string
): Promise<void> => {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error(`Goal not found: ${goalId}`);
  
  const currentBlockers = extractBlockedBy(goal);
  const filtered = currentBlockers.filter(id => id !== blockedByGoalId);
  await updateGoalMetadata(goal, { blockedBy: filtered });
};

// ─────────────────────────────────────────────────────────────────────────────
// METADATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const extractMetadata = (goal: AgentGoal): { parent?: string; blockedBy: string[] } => {
  const metaMatch = goal.description?.match(/\[meta:([^\]]+)\]/);
  if (!metaMatch) return { blockedBy: [] };
  
  const parts = metaMatch[1].split('|');
  let parent: string | undefined;
  let blockedBy: string[] = [];
  
  for (const part of parts) {
    if (part.startsWith('parent:')) {
      parent = part.replace('parent:', '');
    } else if (part.startsWith('blocked_by:')) {
      blockedBy = part.replace('blocked_by:', '').split(',').filter(Boolean);
    }
  }
  
  return { parent, blockedBy };
};

const extractParent = (goal: AgentGoal): string | undefined => {
  return extractMetadata(goal).parent;
};

const extractBlockedBy = (goal: AgentGoal): string[] => {
  return extractMetadata(goal).blockedBy;
};

const updateGoalMetadata = async (
  goal: AgentGoal,
  updates: { parent?: string; blockedBy?: string[] }
): Promise<void> => {
  const current = extractMetadata(goal);
  const newMeta = { ...current, ...updates };
  const blockedBy = newMeta.blockedBy ?? [];
  
  const metaParts: string[] = [];
  if (newMeta.parent) metaParts.push(`parent:${newMeta.parent}`);
  if (blockedBy.length > 0) metaParts.push(`blocked_by:${blockedBy.join(',')}`);
  
  // Remove old metadata and add new
  const cleanDescription = goal.description?.replace(/\n?\[meta:[^\]]+\]/, '') || '';
  const newDescription = metaParts.length > 0 
    ? cleanDescription + (cleanDescription ? '\n' : '') + `[meta:${metaParts.join('|')}]`
    : cleanDescription;
  
  await updateGoal(goal.id, { description: newDescription });
};

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH BUILDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the goal hierarchy for a project
 */
export const buildGoalGraph = async (
  projectId: string
): Promise<GoalHierarchy> => {
  const goals = await getGoals(projectId);
  
  if (goals.length === 0) {
    return {
      roots: [],
      totalGoals: 0,
      completedGoals: 0,
      blockedGoals: 0,
      overallProgress: 0,
    };
  }
  
  const goalMap = new Map<string, AgentGoal>(goals.map(g => [g.id, g]));
  const nodeMap = new Map<string, GoalNode>();
  
  // First pass: create nodes
  for (const goal of goals) {
    const metadata = extractMetadata(goal);
    const isBlocked = metadata.blockedBy.some(id => {
      const blocker = goalMap.get(id);
      return blocker && blocker.status !== 'completed';
    });
    
    const blockedByNames = metadata.blockedBy
      .map(id => goalMap.get(id)?.title || id)
      .filter(name => {
        const blocker = goals.find(g => g.title === name || g.id === name);
        return blocker && blocker.status !== 'completed';
      });
    
    nodeMap.set(goal.id, {
      ...goal,
      depth: 0,
      children: [],
      isBlocked,
      blockedByNames,
      completionPercent: goal.progress,
      path: [goal.id],
    });
  }
  
  // Second pass: build hierarchy
  const roots: GoalNode[] = [];
  
  for (const goal of goals) {
    const node = nodeMap.get(goal.id)!;
    const parentId = extractParent(goal);
    
    if (parentId && nodeMap.has(parentId)) {
      const parent = nodeMap.get(parentId)!;
      parent.children.push(node);
      node.depth = parent.depth + 1;
      node.path = [...parent.path, goal.id];
    } else {
      roots.push(node);
    }
  }
  
  // Third pass: calculate completion percentages for parents
  const calculateCompletion = (node: GoalNode): number => {
    if (node.children.length === 0) {
      return node.progress;
    }
    
    const childCompletions = node.children.map(calculateCompletion);
    const avgChildCompletion = childCompletions.reduce((a, b) => a + b, 0) / childCompletions.length;
    
    // Parent completion is weighted: 30% own progress + 70% children progress
    node.completionPercent = Math.round(node.progress * 0.3 + avgChildCompletion * 0.7);
    return node.completionPercent;
  };
  
  roots.forEach(calculateCompletion);
  
  // Calculate summary stats
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const blockedGoals = Array.from(nodeMap.values()).filter(n => n.isBlocked).length;
  const overallProgress = totalGoals > 0 
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / totalGoals)
    : 0;
  
  return {
    roots,
    totalGoals,
    completedGoals,
    blockedGoals,
    overallProgress,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all blocked goals
 */
export const getBlockedGoals = async (
  projectId: string
): Promise<GoalNode[]> => {
  const hierarchy = await buildGoalGraph(projectId);
  
  const collectBlocked = (nodes: GoalNode[]): GoalNode[] => {
    const blocked: GoalNode[] = [];
    for (const node of nodes) {
      if (node.isBlocked) blocked.push(node);
      blocked.push(...collectBlocked(node.children));
    }
    return blocked;
  };
  
  return collectBlocked(hierarchy.roots);
};

/**
 * Get goals that can be worked on (not blocked, not completed)
 */
export const getActionableGoals = async (
  projectId: string
): Promise<GoalNode[]> => {
  const hierarchy = await buildGoalGraph(projectId);
  
  const collectActionable = (nodes: GoalNode[]): GoalNode[] => {
    const actionable: GoalNode[] = [];
    for (const node of nodes) {
      if (!node.isBlocked && node.status === 'active') {
        actionable.push(node);
      }
      actionable.push(...collectActionable(node.children));
    }
    return actionable;
  };
  
  return collectActionable(hierarchy.roots);
};

/**
 * Get the critical path (chain of dependent goals)
 */
export const getCriticalPath = async (
  projectId: string,
  targetGoalId: string
): Promise<AgentGoal[]> => {
  const goals = await getGoals(projectId);
  const goalMap = new Map<string, AgentGoal>(goals.map(g => [g.id, g]));
  
  const path: AgentGoal[] = [];
  const visited = new Set<string>();
  
  const collectPath = (goalId: string): void => {
    if (visited.has(goalId)) return;
    visited.add(goalId);
    
    const goal = goalMap.get(goalId);
    if (!goal) return;
    
    const blockers = extractBlockedBy(goal);
    for (const blockerId of blockers) {
      collectPath(blockerId);
    }
    
    path.push(goal);
  };
  
  collectPath(targetGoalId);
  return path;
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT FOR PROMPT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format goal hierarchy for agent context
 */
export const formatGoalHierarchy = (hierarchy: GoalHierarchy): string => {
  if (hierarchy.totalGoals === 0) {
    return '## Goals\nNo goals defined.\n';
  }
  
  let output = '## Goals\n';
  output += `Progress: ${hierarchy.overallProgress}% (${hierarchy.completedGoals}/${hierarchy.totalGoals} complete)\n`;
  
  if (hierarchy.blockedGoals > 0) {
    output += `⚠️ ${hierarchy.blockedGoals} blocked goals\n`;
  }
  
  output += '\n';
  
  const formatNode = (node: GoalNode, indent: string = ''): string => {
    let line = indent;
    
    // Status icon
    if (node.status === 'completed') {
      line += '✅ ';
    } else if (node.isBlocked) {
      line += '⛔ ';
    } else if (node.status === 'active') {
      line += '🔄 ';
    } else {
      line += '⏸️ ';
    }
    
    line += `[${node.completionPercent}%] ${node.title}`;
    
    if (node.isBlocked && node.blockedByNames.length > 0) {
      line += ` (blocked by: ${node.blockedByNames.join(', ')})`;
    }
    
    line += '\n';
    
    // Recurse for children
    for (const child of node.children) {
      line += formatNode(child, indent + '  ');
    }
    
    return line;
  };
  
  for (const root of hierarchy.roots) {
    output += formatNode(root);
  }
  
  return output;
};

/**
 * Format actionable goals as suggestions
 */
export const formatActionableGoals = async (
  projectId: string
): Promise<string> => {
  const actionable = await getActionableGoals(projectId);
  
  if (actionable.length === 0) {
    return 'All goals are either completed or blocked.';
  }
  
  let output = 'Actionable goals:\n';
  for (const goal of actionable.slice(0, 5)) {
    output += `• ${goal.title} (${goal.completionPercent}%)\n`;
  }
  
  return output;
};
