import type { Abi } from 'viem'

export const marketplaceAbi = [
  {
    inputs: [
      {
        internalType: 'string',
        name: '_descriptionHash',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: '_maxTime',
        type: 'uint256',
      },
    ],
    name: 'postTask',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: '_solutionHash',
        type: 'string',
      },
    ],
    name: 'submitSolution',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: '_approved',
        type: 'bool',
      },
    ],
    name: 'verifySolution',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
    ],
    name: 'createDispute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_tokenAmount',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'supportsSolution',
        type: 'bool',
      },
    ],
    name: 'jurorVote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'submitCost',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifyCost',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
    ],
    name: 'finalizeTask',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
    ],
    name: 'finalizeDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'minJurorStake',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'disputePeriod',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'governanceToken',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_taskId',
        type: 'uint256',
      },
    ],
    name: 'getTask',
    outputs: [
      {
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'solver',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'verifier',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'bounty',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: 'descriptionHash',
        type: 'string',
      },
      {
        internalType: 'string',
        name: 'solutionHash',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'solve_deadline',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'approved',
        type: 'bool',
      },
      {
        internalType: 'uint256',
        name: 'deadline',
        type: 'uint256',
      },
      {
        internalType: 'enum TaskMarketplace.TaskStatus',
        name: 'status',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTaskCount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi

// @ts-ignore
export const TASK_STATUS_LABELS = [
  'Open',
  'Submitted',
  'Verified',
  'Disputed',
  'Accepted',
  'Rejected',
  'Unsolved',
] as const
