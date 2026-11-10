import { describe, expect, it } from 'vitest'
import { createDefaultPlan, FORMATIONS } from '../data'
import { defaultRoleFor, roleOptions, roleProfile, rolesForPosition, slotRole } from '../roles'

describe('position roles', () => {
  it('gives every position a default role that exists', () => {
    const positions = new Set(FORMATIONS['4-3-3']!.map((s) => s.position))
    for (const position of positions) {
      const fallback = defaultRoleFor(position)
      expect(rolesForPosition(position)).toContain(fallback)
      expect(roleProfile(fallback, position).label.length).toBeGreaterThan(2)
    }
  })

  it('offers distinct, described roles', () => {
    const all = roleOptions()
    const labels = all.map((r) => r.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const role of all) expect(role.description.length).toBeGreaterThan(10)
  })

  it('reads the role off the plan and falls back to the position default', () => {
    const plan = createDefaultPlan('bracelonia')
    const dm = plan.slots.find((s) => s.slotId === 'dm')!
    expect(slotRole(plan, 'dm', 'DM')).toBe('holding')
    dm.role = 'box-to-box'
    expect(slotRole(plan, 'dm', 'DM')).toBe('box-to-box')
    dm.role = 'not-a-real-role'
    expect(slotRole(plan, 'dm', 'DM')).toBe('holding')
  })

  it('ships a role on every slot of a fresh plan', () => {
    for (const teamId of ['bracelonia', 'banyarn'] as const) {
      const plan = createDefaultPlan(teamId)
      expect(plan.slots.every((s) => typeof s.role === 'string' && s.role.length > 0)).toBe(true)
    }
  })
})
