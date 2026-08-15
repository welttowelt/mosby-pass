use starknet::ContractAddress;

// Positional Serde must match privacy::objects::OpenNoteDeposit.
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

#[starknet::interface]
pub trait IERC20<TState> {
    fn balance_of(self: @TState, account: ContractAddress) -> u256;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IVeilpass<TState> {
    fn privacy_invoke(
        ref self: TState,
        token: ContractAddress,
        amount: u128,
        commitment: felt252,
        duration_seconds: u64,
        offer_commitment: felt252,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
    fn get_pool(self: @TState) -> ContractAddress;
    fn get_started(self: @TState, commitment: felt252) -> u64;
    fn get_expiry(self: @TState, commitment: felt252) -> u64;
    fn get_offer(self: @TState, commitment: felt252) -> felt252;
    fn get_note(self: @TState, commitment: felt252) -> felt252;
    fn is_note_used(self: @TState, note_id: felt252) -> bool;
    fn is_active(self: @TState, commitment: felt252) -> bool;
}

#[starknet::contract]
pub mod Veilpass {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait, OpenNoteDeposit};

    pub const MAX_MEMBERSHIP_DURATION: u64 = 31_622_400; // 366 days.

    pub mod errors {
        pub const ZERO_POOL: felt252 = 'ZERO_POOL';
        pub const ONLY_POOL: felt252 = 'ONLY_POOL';
        pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
        pub const ZERO_NOTE: felt252 = 'ZERO_NOTE';
        pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
        pub const ZERO_COMMITMENT: felt252 = 'ZERO_COMMITMENT';
        pub const ZERO_OFFER: felt252 = 'ZERO_OFFER';
        pub const ZERO_DURATION: felt252 = 'ZERO_DURATION';
        pub const DURATION_TOO_LONG: felt252 = 'DURATION_TOO_LONG';
        pub const DUPLICATE: felt252 = 'DUPLICATE';
        pub const DUPLICATE_NOTE: felt252 = 'DUPLICATE_NOTE';
        pub const INSUFFICIENT_BALANCE: felt252 = 'INSUFFICIENT_BALANCE';
        pub const APPROVE_FAILED: felt252 = 'APPROVE_FAILED';
    }

    #[storage]
    struct Storage {
        pool: ContractAddress,
        membership_started: Map<felt252, u64>,
        membership_expiry: Map<felt252, u64>,
        membership_offer: Map<felt252, felt252>,
        membership_note: Map<felt252, felt252>,
        used_note: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MembershipActivated: MembershipActivated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MembershipActivated {
        #[key]
        pub commitment: felt252,
        #[key]
        pub offer_commitment: felt252,
        pub started_at: u64,
        pub expires_at: u64,
        pub token: ContractAddress,
        pub amount: u128,
        pub note_id: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, pool: ContractAddress) {
        assert(pool.is_non_zero(), errors::ZERO_POOL);
        self.pool.write(pool);
    }

    #[abi(embed_v0)]
    impl VeilpassImpl of super::IVeilpass<ContractState> {
        // Intentionally callable only by the configured STRK20 pool. The user's
        // wallet, viewing key, creator address, offer id, and tier never enter this ABI.
        fn privacy_invoke(
            ref self: ContractState,
            token: ContractAddress,
            amount: u128,
            commitment: felt252,
            duration_seconds: u64,
            offer_commitment: felt252,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            let caller = get_caller_address();
            let configured_pool = self.pool.read();
            assert(caller == configured_pool, errors::ONLY_POOL);
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(note_id != 0, errors::ZERO_NOTE);
            assert(amount != 0, errors::ZERO_AMOUNT);
            assert(commitment != 0, errors::ZERO_COMMITMENT);
            assert(offer_commitment != 0, errors::ZERO_OFFER);
            assert(duration_seconds != 0, errors::ZERO_DURATION);
            assert(duration_seconds <= MAX_MEMBERSHIP_DURATION, errors::DURATION_TOO_LONG);

            let now = get_block_timestamp();
            let expires_at = now + duration_seconds;
            assert(self.membership_expiry.entry(commitment).read() == 0, errors::DUPLICATE);
            assert(!self.used_note.entry(note_id).read(), errors::DUPLICATE_NOTE);

            let erc20 = IERC20Dispatcher { contract_address: token };
            let amount_u256: u256 = amount.into();
            let balance = erc20.balance_of(get_contract_address());
            assert(balance >= amount_u256, errors::INSUFFICIENT_BALANCE);

            // Approval is limited to this payment. Record membership only after
            // the token confirms approval, without depending on rollback behavior.
            let approved = erc20.approve(caller, amount_u256);
            assert(approved, errors::APPROVE_FAILED);
            self.membership_started.entry(commitment).write(now);
            self.membership_expiry.entry(commitment).write(expires_at);
            self.membership_offer.entry(commitment).write(offer_commitment);
            self.membership_note.entry(commitment).write(note_id);
            self.used_note.entry(note_id).write(true);
            self
                .emit(
                    MembershipActivated {
                        commitment,
                        offer_commitment,
                        started_at: now,
                        expires_at,
                        token,
                        amount,
                        note_id,
                    },
                );

            array![OpenNoteDeposit { note_id, token, amount }].span()
        }

        fn get_pool(self: @ContractState) -> ContractAddress {
            self.pool.read()
        }

        fn get_started(self: @ContractState, commitment: felt252) -> u64 {
            self.membership_started.entry(commitment).read()
        }

        fn get_expiry(self: @ContractState, commitment: felt252) -> u64 {
            self.membership_expiry.entry(commitment).read()
        }

        fn get_offer(self: @ContractState, commitment: felt252) -> felt252 {
            self.membership_offer.entry(commitment).read()
        }

        fn get_note(self: @ContractState, commitment: felt252) -> felt252 {
            self.membership_note.entry(commitment).read()
        }

        fn is_note_used(self: @ContractState, note_id: felt252) -> bool {
            self.used_note.entry(note_id).read()
        }

        fn is_active(self: @ContractState, commitment: felt252) -> bool {
            self.membership_expiry.entry(commitment).read() > get_block_timestamp()
        }
    }
}
