'use strict';

/**
 * 狀態機測試
 * 每個狀態的轉換邏輯
 */

const assert = require('assert');

// Load state machine
const { STATES, getState, setState, clearState, transition } = require('../src/states/stateMachine');
const { isOrderIntent, isGreeting } = require('../src/states/idle');
const { isConfirmReply, isCancelReply, isModifyIntent } = require('../src/states/confirming');
const { isPaymentConfirmed, isPaymentCancel } = require('../src/states/awaitingPayment');

console.log('\n=== State Machine Tests ===');

// Test IDLE transitions
console.log('\n--- IDLE State ---');
const userId1 = 'test_user_idle_1';

// Initial state should be IDLE
const state1 = getState(userId1);
assert.strictEqual(state1.state, STATES.IDLE, 'Initial state should be IDLE');
console.log('  ✓ Initial state is IDLE');

// Greeting message should stay in IDLE
clearState(userId1);
const idleResult1 = transition(userId1, 'greeting', {});
assert.strictEqual(idleResult1.newState, STATES.IDLE, 'Greeting should stay in IDLE');
console.log('  ✓ Greeting stays in IDLE');

// Order intent should transition to AWAITING_INFO
clearState(userId1);
const idleResult2 = transition(userId1, 'order_intent', {});
assert.strictEqual(idleResult2.newState, STATES.AWAITING_INFO, 'Order intent should go to AWAITING_INFO');
console.log('  ✓ Order intent transitions to AWAITING_INFO');

// Test isOrderIntent / isGreeting
assert.strictEqual(isOrderIntent('我要訂購'), true, '我要訂購 should be order intent');
assert.strictEqual(isOrderIntent('我要下單'), true, '我要下單 should be order intent');
assert.strictEqual(isOrderIntent('你好'), false, '你好 should not be order intent');
assert.strictEqual(isGreeting('嗨'), true, '嗨 should be greeting');
assert.strictEqual(isGreeting('我要訂購'), false, '我要訂購 should not be greeting');
console.log('  ✓ Intent detection works');

// Test AWAITING_INFO
console.log('\n--- AWAITING_INFO State ---');
const userId2 = 'test_user_awaiting_1';
setState(userId2, { state: STATES.AWAITING_INFO, orderData: {}, context: { awaitingField: 'address' } });

const awaitingResult1 = transition(userId2, 'field_received', {
  fieldName: 'address',
  value: '三峽北大特區',
  nextField: 'name',
  validationFailed: false,
});
assert.strictEqual(awaitingResult1.newState, STATES.AWAITING_INFO, 'Should stay in AWAITING_INFO');
assert.strictEqual(awaitingResult1.orderData.address, '三峽北大特區', 'Address should be saved');
console.log('  ✓ Field received and saved');

// Validation failure should stay in REASK_INFO
const userId2b = 'test_user_reask_1';
setState(userId2b, { state: STATES.REASK_INFO, orderData: {}, context: { awaitingField: 'phone' } });
const reaskResult = transition(userId2b, 'field_received', {
  fieldName: 'phone',
  value: '123',
  nextField: 'phone',
  validationFailed: true,
  errorMessage: '電話格式有誤',
});
assert.strictEqual(reaskResult.newState, STATES.REASK_INFO, 'Should stay in REASK_INFO');
console.log('  ✓ Validation failure stays in REASK_INFO');

// Test CONFIRMING
console.log('\n--- CONFIRMING State ---');
const userId3 = 'test_user_confirming_1';
setState(userId3, { state: STATES.CONFIRMING, orderData: {}, context: {} });

// Customer confirms
const confirmResult = transition(userId3, 'customer_confirm', {});
assert.strictEqual(confirmResult.newState, STATES.AWAITING_PAYMENT, 'Confirm should go to AWAITING_PAYMENT');
console.log('  ✓ Confirm transitions to AWAITING_PAYMENT');

// Customer cancels
const userId3b = 'test_user_confirming_2';
setState(userId3b, { state: STATES.CONFIRMING, orderData: {}, context: {} });
const cancelResult = transition(userId3b, 'customer_cancel', {});
assert.strictEqual(cancelResult.newState, STATES.IDLE, 'Cancel should go to IDLE');
console.log('  ✓ Cancel transitions to IDLE');

// isConfirmReply / isCancelReply / isModifyIntent
assert.strictEqual(isConfirmReply('確認'), true, '確認 should be confirm');
assert.strictEqual(isConfirmReply('ok'), true, 'ok should be confirm');
assert.strictEqual(isConfirmReply('我要修改'), false, '我要修改 should not be confirm');
assert.strictEqual(isCancelReply('取消'), true, '取消 should be cancel');
assert.strictEqual(isModifyIntent('改一下'), true, '改一下 should be modify intent');
console.log('  ✓ Confirm/Cancel/Modify detection works');

// Test AWAITING_PAYMENT
console.log('\n--- AWAITING_PAYMENT State ---');
const userId4 = 'test_user_payment_1';
setState(userId4, { state: STATES.AWAITING_PAYMENT, orderData: { payment_method: 'cash' }, context: {} });

const paymentResult1 = transition(userId4, 'payment_received', {});
assert.strictEqual(paymentResult1.newState, STATES.COMPLETED, 'Payment received should go to COMPLETED');
console.log('  ✓ Payment received transitions to COMPLETED');

// isPaymentConfirmed / isPaymentCancel
assert.strictEqual(isPaymentConfirmed('已轉帳'), true, '已轉帳 should be payment confirmed');
assert.strictEqual(isPaymentConfirmed('已付款'), true, '已付款 should be payment confirmed');
assert.strictEqual(isPaymentCancel('取消'), true, '取消 should be payment cancel');
console.log('  ✓ Payment confirmation detection works');

// Test COMPLETED
console.log('\n--- COMPLETED State ---');
const userId5 = 'test_user_completed_1';
setState(userId5, { state: STATES.COMPLETED, orderData: {}, context: {} });

const completedResult = transition(userId5, 'new_order', {});
assert.strictEqual(completedResult.newState, STATES.AWAITING_INFO, 'New order from completed should go to AWAITING_INFO');
console.log('  ✓ New order from COMPLETED goes to AWAITING_INFO');

// Test HUMAN_HANDOFF
console.log('\n--- HUMAN_HANDOFF State ---');
const userId6 = 'test_user_handoff_1';
setState(userId6, { state: STATES.HUMAN_HANDOFF, orderData: {}, context: {} });

const handoffResult = transition(userId6, 'any_event', {});
assert.strictEqual(handoffResult.newState, STATES.HUMAN_HANDOFF, 'HUMAN_HANDOFF should not transition');
console.log('  ✓ HUMAN_HANDOFF stays in HUMAN_HANDOFF');

// Test state persistence
console.log('\n--- State Persistence ---');
const userId7 = 'test_user_persist_1';
setState(userId7, { state: STATES.CONFIRMING, orderData: { address: 'test', total_amount: 500 }, context: {} });
const saved = getState(userId7);
assert.strictEqual(saved.state, STATES.CONFIRMING, 'State should be saved');
assert.strictEqual(saved.orderData.address, 'test', 'Order data should be saved');
assert.strictEqual(saved.orderData.total_amount, 500, 'Order data should persist');
console.log('  ✓ State persists correctly');

// Clear state
clearState(userId7);
const cleared = getState(userId7);
assert.strictEqual(cleared.state, STATES.IDLE, 'Cleared state should be IDLE');
console.log('  ✓ Clear state works');

console.log('\n========================================');
console.log('ALL STATE MACHINE TESTS PASSED ✓');
console.log('========================================\n');
