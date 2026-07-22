'use strict';

/**
 * 狀態機測試
 * 每個狀態的轉換邏輯
 */

const assert = require('assert');
const { test } = require('node:test');

const { STATES, getState, setState, clearState, transition } = require('../src/states/stateMachine');
const { isOrderIntent, isGreeting } = require('../src/states/idle');
const { isConfirmReply, isCancelReply, isModifyIntent } = require('../src/states/confirming');
const { isPaymentConfirmed, isPaymentCancel } = require('../src/states/awaitingPayment');

test('IDLE State — initial / greeting / order_intent / intent detection', () => {
  const userId1 = 'test_user_idle_1';
  const state1 = getState(userId1);
  assert.strictEqual(state1.state, STATES.IDLE, 'Initial state should be IDLE');

  // Greeting message should stay in IDLE
  clearState(userId1);
  const idleResult1 = transition(userId1, 'greeting', {});
  assert.strictEqual(idleResult1.newState, STATES.IDLE, 'Greeting should stay in IDLE');

  // Order intent should transition to AWAITING_INFO
  clearState(userId1);
  const idleResult2 = transition(userId1, 'order_intent', {});
  assert.strictEqual(idleResult2.newState, STATES.AWAITING_INFO, 'Order intent should go to AWAITING_INFO');

  // isOrderIntent / isGreeting
  assert.strictEqual(isOrderIntent('我要訂購'), true, '我要訂購 should be order intent');
  assert.strictEqual(isOrderIntent('我要下單'), true, '我要下單 should be order intent');
  assert.strictEqual(isOrderIntent('你好'), false, '你好 should not be order intent');
  assert.strictEqual(isGreeting('嗨'), true, '嗨 should be greeting');
  assert.strictEqual(isGreeting('我要訂購'), false, '我要訂購 should not be greeting');
});

test('AWAITING_INFO State — field received / REASK_INFO on validation fail', () => {
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
});

test('CONFIRMING State — confirm / cancel / intent detection', () => {
  const userId3 = 'test_user_confirming_1';
  setState(userId3, { state: STATES.CONFIRMING, orderData: {}, context: {} });
  const confirmResult = transition(userId3, 'customer_confirm', {});
  assert.strictEqual(confirmResult.newState, STATES.AWAITING_PAYMENT, 'Confirm should go to AWAITING_PAYMENT');

  const userId3b = 'test_user_confirming_2';
  setState(userId3b, { state: STATES.CONFIRMING, orderData: {}, context: {} });
  const cancelResult = transition(userId3b, 'customer_cancel', {});
  assert.strictEqual(cancelResult.newState, STATES.IDLE, 'Cancel should go to IDLE');

  assert.strictEqual(isConfirmReply('確認'), true);
  assert.strictEqual(isConfirmReply('ok'), true);
  assert.strictEqual(isConfirmReply('我要修改'), false);
  assert.strictEqual(isCancelReply('取消'), true);
  assert.strictEqual(isModifyIntent('改一下'), true);
});

test('AWAITING_PAYMENT State — payment_received → COMPLETED / intent detection', () => {
  const userId4 = 'test_user_payment_1';
  setState(userId4, { state: STATES.AWAITING_PAYMENT, orderData: { payment_method: 'cash' }, context: {} });
  const paymentResult1 = transition(userId4, 'payment_received', {});
  assert.strictEqual(paymentResult1.newState, STATES.COMPLETED, 'Payment received should go to COMPLETED');

  assert.strictEqual(isPaymentConfirmed('已轉帳'), true);
  assert.strictEqual(isPaymentConfirmed('已付款'), true);
  assert.strictEqual(isPaymentCancel('取消'), true);
});

test('COMPLETED State — new_order transitions to AWAITING_INFO', () => {
  const userId5 = 'test_user_completed_1';
  setState(userId5, { state: STATES.COMPLETED, orderData: {}, context: {} });
  const completedResult = transition(userId5, 'new_order', {});
  assert.strictEqual(completedResult.newState, STATES.AWAITING_INFO, 'New order from completed should go to AWAITING_INFO');
});

test('HUMAN_HANDOFF State — no auto-transition', () => {
  const userId6 = 'test_user_handoff_1';
  setState(userId6, { state: STATES.HUMAN_HANDOFF, orderData: {}, context: {} });
  const handoffResult = transition(userId6, 'any_event', {});
  assert.strictEqual(handoffResult.newState, STATES.HUMAN_HANDOFF, 'HUMAN_HANDOFF should not transition');
});

test('State Persistence — setState + getState + clearState', () => {
  const userId7 = 'test_user_persist_1';
  setState(userId7, { state: STATES.CONFIRMING, orderData: { address: 'test', total_amount: 500 }, context: {} });
  const saved = getState(userId7);
  assert.strictEqual(saved.state, STATES.CONFIRMING);
  assert.strictEqual(saved.orderData.address, 'test');
  assert.strictEqual(saved.orderData.total_amount, 500);

  clearState(userId7);
  const cleared = getState(userId7);
  assert.strictEqual(cleared.state, STATES.IDLE, 'Cleared state should be IDLE');
});
