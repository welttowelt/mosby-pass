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
        expires_at: u64,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
    fn get_pool(self: @TState) -> ContractAddress;
    fn get_expiry(self: @TState, commitment: felt252) -> u64;
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
        pub const EXPIRED: felt252 = 'EXPIRED';
        pub const DURATION_TOO_LONG: felt252 = 'DURATION_TOO_LONG';
        pub const DUPLICATE: felt252 = 'DUPLICATE';
        pub const INSUFFICIENT_BALANCE: felt252 = 'INSUFFICIENT_BALANCE';
        pub const APPROVE_FAILED: felt252 = 'APPROVE_FAILED';
    }

    #[storage]
    struct Storage {
        pool: ContractAddress,
        membership_expiry: Map<felt252, u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MembershipActivated: MembershipActivated,
    }

    #[derive(Drop, starknet::Event)]
    struct MembershipActivated {
        #[key]
        commitment: felt252,
        expires_at: u64,
        token: ContractAddress,
        amount: u128,
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
            expires_at: u64,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            let caller = get_caller_address();
            let configured_pool = self.pool.read();
            assert(caller == configured_pool, errors::ONLY_POOL);
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(note_id != 0, errors::ZERO_NOTE);
            assert(amount != 0, errors::ZERO_AMOUNT);
            assert(commitment != 0, errors::ZERO_COMMITMENT);

            let now = get_block_timestamp();
            assert(expires_at > now, errors::EXPIRED);
            assert(expires_at - now <= MAX_MEMBERSHIP_DURATION, errors::DURATION_TOO_LONG);
            assert(self.membership_expiry.entry(commitment).read() == 0, errors::DUPLICATE);

            let erc20 = IERC20Dispatcher { contract_address: token };
            let amount_u256: u256 = amount.into();
            let balance = erc20.balance_of(get_contract_address());
            assert(balance >= amount_u256, errors::INSUFFICIENT_BALANCE);

            // Approval is limited to this payment. Record membership only after
            // the token confirms approval, without depending on rollback behavior.
            let approved = erc20.approve(caller, amount_u256);
            assert(approved, errors::APPROVE_FAILED);
            self.membership_expiry.entry(commitment).write(expires_at);
            self.emit(MembershipActivated { commitment, expires_at, token, amount });

            array![OpenNoteDeposit { note_id, token, amount }].span()
        }

        fn get_pool(self: @ContractState) -> ContractAddress {
            self.pool.read()
        }

        fn get_expiry(self: @ContractState, commitment: felt252) -> u64 {
            self.membership_expiry.entry(commitment).read()
        }

        fn is_active(self: @ContractState, commitment: felt252) -> bool {
            self.membership_expiry.entry(commitment).read() > get_block_timestamp()
        }
    }
}
