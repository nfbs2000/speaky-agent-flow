import assert from 'node:assert/strict'
import test from 'node:test'

import { claimVerdictAppearance } from '../web/lib/education-claim-status'

test('chapter verdict labels preserve each evidence status', () => {
  assert.equal(claimVerdictAppearance('configured').label, 'CONFIGURED')
  assert.equal(claimVerdictAppearance('observed').label, 'OBSERVED')
  assert.equal(claimVerdictAppearance('inferred').label, 'INFERRED')
  assert.equal(claimVerdictAppearance('not_observed').label, 'NOT OBSERVED')
  assert.equal(claimVerdictAppearance('correction_required').label, 'CORRECTION REQUIRED')
  assert.equal(claimVerdictAppearance('additional_observation_required').label, 'MORE EVIDENCE')
})

test('unknown verdict labels remain visible instead of becoming more evidence', () => {
  assert.equal(claimVerdictAppearance('future_status').label, 'FUTURE STATUS')
})
