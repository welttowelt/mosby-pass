use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events,
    start_cheat_block_timestamp, start_cheat_caller_address,
};
use starknet::ContractAddress;
use veilpass::Veilpass::{Event, MAX_MEMBERSHIP_DURATION, MembershipActivated};
use veilpass::{
    IVeilpassDispatcher, IVeilpassDispatcherTrait, IVeilpassSafeDispatcher,
    IVeilpassSafeDispatcherTrait,
};

#[starknet::interface]
trait ITestToken<TState> {
    fn mint(ref self: TState, recipient: ContractAddress, amount: u256);
    fn set_approve_result(ref self: TState, result: bool);
    fn balance_of(self: @TState, account: ContractAddress) -> u256;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TState, owner: ContractAddress, spender: ContractAddress) -> u256;
}

#[starknet::contract]
mod TestToken {
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        approve_result: bool,
    }

    #[abi(embed_v0)]
    impl TestTokenImpl of super::ITestToken<ContractState> {
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            let current = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(current + amount);
        }

        fn set_approve_result(ref self: ContractState, result: bool) {
            self.approve_result.write(result);
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let result = self.approve_result.read();
            if !result {
                return false;
            }
            let owner = get_caller_address();
            self.allowances.entry((owner, spender)).write(amount);
            result
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.entry((owner, spender)).read()
        }
    }
}

const NOW: u64 = 1_786_780_000;

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn deploy_veilpass(pool: ContractAddress) -> (ContractAddress, IVeilpassDispatcher) {
    let contract = declare("Veilpass").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![pool.into()]).unwrap();
    (address, IVeilpassDispatcher { contract_address: address })
}

fn deploy_token() -> (ContractAddress, ITestTokenDispatcher) {
    let contract = declare("TestToken").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![]).unwrap();
    (address, ITestTokenDispatcher { contract_address: address })
}

fn setup() -> (ContractAddress, ContractAddress, IVeilpassDispatcher, ITestTokenDispatcher) {
    let pool = addr(0x5001);
    let (helper_address, helper) = deploy_veilpass(pool);
    let (token_address, token) = deploy_token();
    token.set_approve_result(true);
    start_cheat_block_timestamp(helper_address, NOW);
    (pool, token_address, helper, token)
}

#[test]
fn activation_routes_exact_amount_and_records_expiry() {
    let (pool, token_address, helper, token) = setup();
    let amount: u128 = 600;
    let commitment = 0xc0ffee;
    let duration = 30 * 24 * 60 * 60;
    let expiry = NOW + duration;
    token.mint(helper.contract_address, 1_000);
    start_cheat_caller_address(helper.contract_address, pool);
    let mut spy = spy_events();

    let offer_commitment = 0x0f2;
    let outputs = helper
        .privacy_invoke(token_address, amount, commitment, duration, offer_commitment, 0xabc);

    assert(outputs.len() == 1, 'BAD_OUTPUT_COUNT');
    let output = *outputs.at(0);
    assert(output.note_id == 0xabc, 'BAD_NOTE');
    assert(output.token == token_address, 'BAD_TOKEN');
    assert(output.amount == amount, 'BAD_AMOUNT');
    let amount_u256: u256 = amount.into();
    assert(token.allowance(helper.contract_address, pool) == amount_u256, 'BAD_ALLOWANCE');
    assert(helper.get_started(commitment) == NOW, 'BAD_STARTED');
    assert(helper.get_expiry(commitment) == expiry, 'BAD_EXPIRY');
    assert(helper.get_offer(commitment) == offer_commitment, 'BAD_OFFER');
    assert(helper.get_note(commitment) == 0xabc, 'BAD_STORED_NOTE');
    assert(helper.is_active(commitment), 'NOT_ACTIVE');
    spy
        .assert_emitted(
            @array![
                (
                    helper.contract_address,
                    Event::MembershipActivated(
                        MembershipActivated {
                            commitment,
                            offer_commitment,
                            started_at: NOW,
                            expires_at: expiry,
                            token: token_address,
                            amount,
                            note_id: 0xabc,
                        },
                    ),
                ),
            ],
        );
}

#[test]
#[should_panic(expected: 'ONLY_POOL')]
fn activation_rejects_non_pool_caller() {
    let (_, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 100);
    start_cheat_caller_address(helper.contract_address, addr(0xbad));
    helper.privacy_invoke(token_address, 100, 11, 60, 91, 1);
}

#[test]
#[should_panic(expected: 'ZERO_TOKEN')]
fn activation_rejects_zero_token() {
    let (pool, _, helper, _) = setup();
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(addr(0), 100, 18, 60, 91, 1);
}

#[test]
#[should_panic(expected: 'ZERO_NOTE')]
fn activation_rejects_zero_note() {
    let (pool, token_address, helper, _) = setup();
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 19, 60, 91, 0);
}

#[test]
#[should_panic(expected: 'ZERO_AMOUNT')]
fn activation_rejects_zero_amount() {
    let (pool, token_address, helper, _) = setup();
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 0, 20, 60, 91, 1);
}

#[test]
#[should_panic(expected: 'ZERO_COMMITMENT')]
fn activation_rejects_zero_commitment() {
    let (pool, token_address, helper, _) = setup();
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 0, 60, 91, 1);
}

#[test]
#[should_panic(expected: 'ZERO_OFFER')]
fn activation_rejects_zero_offer_commitment() {
    let (pool, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 100);
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 21, 60, 0, 1);
}

#[test]
#[should_panic(expected: 'ZERO_DURATION')]
fn activation_rejects_zero_duration() {
    let (pool, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 100);
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 13, 0, 91, 1);
}

#[test]
#[should_panic(expected: 'DURATION_TOO_LONG')]
fn activation_rejects_unbounded_duration() {
    let (pool, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 100);
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 14, MAX_MEMBERSHIP_DURATION + 1, 91, 1);
}

#[test]
#[should_panic(expected: 'DUPLICATE')]
fn activation_rejects_commitment_replay() {
    let (pool, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 200);
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 15, 60, 91, 1);
    helper.privacy_invoke(token_address, 100, 15, 120, 91, 2);
}

#[test]
#[should_panic(expected: 'DUPLICATE_NOTE')]
fn activation_rejects_note_replay_across_memberships() {
    let (pool, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 200);
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 0x151, 60, 91, 0x201);
    helper.privacy_invoke(token_address, 100, 0x152, 60, 91, 0x201);
}

#[test]
#[should_panic(expected: 'INSUFFICIENT_BALANCE')]
fn activation_rejects_amount_above_helper_balance() {
    let (pool, token_address, helper, token) = setup();
    token.mint(helper.contract_address, 99);
    start_cheat_caller_address(helper.contract_address, pool);
    helper.privacy_invoke(token_address, 100, 16, 60, 91, 1);
}

#[test]
#[feature("safe_dispatcher")]
fn failed_approval_reverts_membership_state() {
    let (pool, token_address, helper, token) = setup();
    let commitment = 17;
    token.mint(helper.contract_address, 100);
    token.set_approve_result(false);
    start_cheat_caller_address(helper.contract_address, pool);
    let safe_helper = IVeilpassSafeDispatcher { contract_address: helper.contract_address };

    let result = safe_helper.privacy_invoke(token_address, 100, commitment, 60, 91, 1);

    assert(result.is_err(), 'EXPECTED_REVERT');
    assert(helper.get_expiry(commitment) == 0, 'STATE_NOT_REVERTED');
    assert(helper.get_offer(commitment) == 0, 'OFFER_NOT_REVERTED');
    assert(helper.get_note(commitment) == 0, 'NOTE_NOT_REVERTED');
    assert(!helper.is_note_used(1), 'NOTE_MARKED_USED');
    assert(token.allowance(helper.contract_address, pool) == 0, 'ALLOWANCE_NOT_ZERO');
}

#[test]
fn same_offer_can_activate_distinct_memberships() {
    let (pool, token_address, helper, token) = setup();
    let offer_commitment = 0x0f2;
    token.mint(helper.contract_address, 200);
    start_cheat_caller_address(helper.contract_address, pool);

    helper.privacy_invoke(token_address, 100, 0x101, 60, offer_commitment, 0x201);
    helper.privacy_invoke(token_address, 100, 0x102, 60, offer_commitment, 0x202);

    assert(helper.get_offer(0x101) == offer_commitment, 'BAD_FIRST_OFFER');
    assert(helper.get_offer(0x102) == offer_commitment, 'BAD_SECOND_OFFER');
    assert(helper.get_note(0x101) == 0x201, 'BAD_FIRST_NOTE');
    assert(helper.get_note(0x102) == 0x202, 'BAD_SECOND_NOTE');
}

#[test]
#[fuzzer(runs: 500)]
fn valid_activation_preserves_exact_output(amount_seed: u128, duration_seed: u64) {
    let (pool, token_address, helper, token) = setup();
    let amount = amount_seed % 1_000_000 + 1;
    let duration = duration_seed % MAX_MEMBERSHIP_DURATION + 1;
    let expiry = NOW + duration;
    token.mint(helper.contract_address, amount.into());
    start_cheat_caller_address(helper.contract_address, pool);

    let outputs = helper.privacy_invoke(token_address, amount, 0x888, duration, 0x0f2, 0x777);

    assert(outputs.len() == 1, 'BAD_OUTPUT_COUNT');
    let output = *outputs.at(0);
    assert(output.amount == amount, 'BAD_AMOUNT');
    let amount_u256: u256 = amount.into();
    assert(token.allowance(helper.contract_address, pool) == amount_u256, 'BAD_ALLOWANCE');
    assert(helper.get_expiry(0x888) == expiry, 'BAD_EXPIRY');
    assert(helper.get_offer(0x888) == 0x0f2, 'BAD_OFFER');
    assert(helper.get_note(0x888) == 0x777, 'BAD_STORED_NOTE');
}
