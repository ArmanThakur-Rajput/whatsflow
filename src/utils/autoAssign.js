const User = require('../models/User.model');
const RoundRobinState = require('../models/RoundRobinState.model');

/**
 * Returns the next active employee ID for the given tenant, using
 * round-robin. Uses atomic findOneAndUpdate ($inc) so concurrent leads
 * for the SAME tenant never get assigned to the same employee by
 * mistake. The round-robin counter itself is keyed by tenantId, so two
 * different tenants' counters never interfere with each other.
 * Returns null if no active employees exist for this tenant.
 */
async function getNextEmployee(tenantId) {
  const employees = await User.find(
    { tenantId, role: 'employee', isActive: true },
    '_id'
  ).sort({ createdAt: 1 }); // stable order — oldest first

  if (!employees.length) return null;

  const total = employees.length;

  // Atomically increment counter and get the OLD value back
  const state = await RoundRobinState.findOneAndUpdate(
    { _id: tenantId },
    { $inc: { index: 1 } },
    { upsert: true, new: false } // new:false → returns doc BEFORE increment
  );

  const currentIndex = state ? state.index : 0;
  const assignedEmployee = employees[currentIndex % total];

  return assignedEmployee._id;
}

module.exports = { getNextEmployee };