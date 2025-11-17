import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
    useAccount,
    useConnect,
    useDisconnect,
    useWriteContract,
    useReadContract,
    useWaitForTransactionReceipt,
} from 'wagmi'
import { readContract } from 'wagmi/actions'
import { config } from './wagmi'
import {
    formatEther,
    formatUnits,
    parseEther,
    parseUnits,
    zeroAddress,
    type Address,
    type Hash,
} from 'viem'
import { of as ipfsOnlyHashOf } from 'ipfs-only-hash'
import { marketplaceAbi, TASK_STATUS_LABELS } from './lib/marketplace'
import { erc20MetadataAbi } from './lib/erc20'

type UiTask = {
    id: bigint
    creator: Address
    solver: Address
    verifier: Address
    bountyWei: bigint
    descriptionHash: string
    solutionHash: string
    solveDeadline: bigint
    approved: boolean
    deadline: bigint
    statusIndex: number
}

function App() {
    const { address, isConnected } = useAccount()
    const { connectors, connectAsync, isPending: isConnecting } = useConnect()
    const { disconnectAsync, isPending: isDisconnecting } = useDisconnect()
    const [authStatus, setAuthStatus] = useState<string>('Connect your wallet to get started.')

    const { writeContractAsync } = useWriteContract()

    // ✅ Hardcoded marketplace contract address
    const MARKETPLACE_ADDRESS = '0xF02b8d9BaBe706f196b8e1C7b5AF82549aa6EA8B' as Address

    const [marketplaceStatus, setMarketplaceStatus] = useState<string>(
        'Ready to interact with the marketplace contract.',
    )
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<Hash | undefined>(undefined)
    const [postDescription, setPostDescription] = useState<string>('')
    const [postDescriptionText, setPostDescriptionText] = useState<string>('')
    const [postBounty, setPostBounty] = useState<string>('0.10')
    const [postSolveWindowDays, setPostSolveWindowDays] = useState<string>('7')
    const [submitTaskId, setSubmitTaskId] = useState<string>('')
    const [submitSolutionHash, setSubmitSolutionHash] = useState<string>('')
    const [submitSolutionText, setSubmitSolutionText] = useState<string>('')
    const [generatedDescriptionHash, setGeneratedDescriptionHash] = useState<string>('')
    const [generatedSolutionHash, setGeneratedSolutionHash] = useState<string>('')
    const [verifyTaskId, setVerifyTaskId] = useState<string>('')
    const [verifyApproval, setVerifyApproval] = useState<'approved' | 'rejected'>('approved')
    const [finalizeTaskId, setFinalizeTaskId] = useState<string>('')
    const [jurorTaskId, setJurorTaskId] = useState<string>('')
    const [jurorStakeAmount, setJurorStakeAmount] = useState<string>('')
    const [jurorVoteChoice, setJurorVoteChoice] = useState<'supports' | 'opposes'>('supports')
    const [lookupTaskId, setLookupTaskId] = useState<string>('')
    const [fetchedTask, setFetchedTask] = useState<UiTask | null>(null)
    const [openTasks, setOpenTasks] = useState<UiTask[]>([])
    const [isFetchingOpenTasks, setIsFetchingOpenTasks] = useState(false)
    const [openTasksError, setOpenTasksError] = useState<string | null>(null)

    const textEncoder = useMemo(() => new TextEncoder(), [])

    const computeIpfsReference = useCallback(
        async (text: string): Promise<string> => {
            const cid = await ipfsOnlyHashOf(textEncoder.encode(text), {
                cidVersion: 1,
                rawLeaves: true,
            })
            return `ipfs://${cid}`
        },
        [textEncoder],
    )

    const normalizeContentReference = useCallback((value: string) => {
        const trimmed = value.trim()
        if (!trimmed) {
            return trimmed
        }

        if (trimmed.startsWith('ipfs://') || trimmed.startsWith('0x')) {
            return trimmed
        }

        return `ipfs://${trimmed}`
    }, [])

    // ✅ Always use the hardcoded address
    const typedAddress = MARKETPLACE_ADDRESS

    const {
        data: taskCountData,
        refetch: refetchTaskCount,
        isFetching: isTaskCountFetching,
    } = useReadContract({
        abi: marketplaceAbi,
        address: (typedAddress ?? zeroAddress) as Address,
        functionName: 'getTaskCount',
        query: {
            enabled: Boolean(typedAddress),
        },
    })

    const {
        data: submitCostWei,
        isFetching: isSubmitCostFetching,
    } = useReadContract({
        abi: marketplaceAbi,
        address: (typedAddress ?? zeroAddress) as Address,
        functionName: 'submitCost',
        query: {
            enabled: Boolean(typedAddress),
        },
    })

    const {
        data: verifyCostWei,
        isFetching: isVerifyCostFetching,
    } = useReadContract({
        abi: marketplaceAbi,
        address: (typedAddress ?? zeroAddress) as Address,
        functionName: 'verifyCost',
        query: {
            enabled: Boolean(typedAddress),
        },
    })

    const { data: minJurorStake } = useReadContract({
        abi: marketplaceAbi,
        address: (typedAddress ?? zeroAddress) as Address,
        functionName: 'minJurorStake',
        query: {
            enabled: Boolean(typedAddress),
        },
    })

    const { data: governanceTokenAddress } = useReadContract({
        abi: marketplaceAbi,
        address: (typedAddress ?? zeroAddress) as Address,
        functionName: 'governanceToken',
        query: {
            enabled: Boolean(typedAddress),
        },
    })

    const resolvedGovernanceTokenAddress = useMemo(() => {
        if (!governanceTokenAddress || governanceTokenAddress === zeroAddress) {
            return undefined
        }
        return governanceTokenAddress
    }, [governanceTokenAddress])

    const { data: governanceTokenSymbol } = useReadContract({
        abi: erc20MetadataAbi,
        address: (resolvedGovernanceTokenAddress ?? zeroAddress) as Address,
        functionName: 'symbol',
        query: {
            enabled: Boolean(resolvedGovernanceTokenAddress),
        },
    })

    const { data: governanceTokenDecimals } = useReadContract({
        abi: erc20MetadataAbi,
        address: (resolvedGovernanceTokenAddress ?? zeroAddress) as Address,
        functionName: 'decimals',
        query: {
            enabled: Boolean(resolvedGovernanceTokenAddress),
        },
    })

    const {
        data: txReceipt,
        isFetching: isWaitingReceipt,
        error: txError,
    } = useWaitForTransactionReceipt({
        hash: txHash,
        query: {
            enabled: Boolean(txHash),
        },
    })

    useEffect(() => {
        if (!txReceipt) {
            return
        }

        const blockNumber = txReceipt.blockNumber ? txReceipt.blockNumber.toString() : undefined
        setMarketplaceStatus(
            blockNumber
                ? `Transaction confirmed in block ${blockNumber}.`
                : 'Transaction confirmed.',
        )
        setPendingAction(null)
        setTxHash(undefined)
        if (typedAddress) {
            void refetchTaskCount()
        }
    }, [txReceipt, typedAddress, refetchTaskCount])

    useEffect(() => {
        if (!txError) {
            return
        }
        setMarketplaceStatus(txError instanceof Error ? txError.message : 'Transaction failed.')
        setPendingAction(null)
    }, [txError])

    const activeConnector = useMemo(() => connectors[0], [connectors])

    useEffect(() => {
        let cancelled = false
        const trimmedText = postDescriptionText.trim()

        if (!trimmedText) {
            setGeneratedDescriptionHash('')
            return
        }

        ;(async () => {
            try {
                const cid = await computeIpfsReference(trimmedText)
                if (!cancelled) {
                    setGeneratedDescriptionHash(cid)
                }
            } catch (error) {
                console.error('Failed to generate IPFS CID for task description text', error)
                if (!cancelled) {
                    setGeneratedDescriptionHash('')
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [postDescriptionText, computeIpfsReference])

    useEffect(() => {
        let cancelled = false
        const trimmedText = submitSolutionText.trim()

        if (!trimmedText) {
            setGeneratedSolutionHash('')
            return
        }

        ;(async () => {
            try {
                const cid = await computeIpfsReference(trimmedText)
                if (!cancelled) {
                    setGeneratedSolutionHash(cid)
                }
            } catch (error) {
                console.error('Failed to generate IPFS CID for solution text', error)
                if (!cancelled) {
                    setGeneratedSolutionHash('')
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [submitSolutionText, computeIpfsReference])

    const submitStakeLabel = useMemo(
        () => (submitCostWei ? formatEther(submitCostWei) : null),
        [submitCostWei],
    )

    const verifyStakeLabel = useMemo(
        () => (verifyCostWei ? formatEther(verifyCostWei) : null),
        [verifyCostWei],
    )

    const governanceTokenSymbolLabel = governanceTokenSymbol ?? 'governance tokens'
    const supportsTokenDecimals = typeof governanceTokenDecimals === 'number'
    const minJurorStakeLabel = useMemo(() => {
        if (!minJurorStake) {
            return null
        }

        if (typeof governanceTokenDecimals === 'number') {
            try {
                return formatUnits(minJurorStake, governanceTokenDecimals)
            } catch (error) {
                console.warn('Failed to format juror stake with decimals', error)
            }
        }

        return minJurorStake.toString()
    }, [minJurorStake, governanceTokenDecimals])

    const handleConnect = useCallback(async () => {
        if (!activeConnector) {
            setAuthStatus('No wallet connector available')
            return
        }

        try {
            setAuthStatus('Opening wallet...')
            await connectAsync({ connector: activeConnector })
            setAuthStatus('Wallet connected. You are authenticated via your wallet address.')
        } catch (error) {
            console.error(error)
            setAuthStatus('Failed to connect wallet.')
        }
    }, [activeConnector, connectAsync])

    const handleDisconnect = useCallback(async () => {
        try {
            await disconnectAsync()
        } finally {
            setAuthStatus('Disconnected. Connect your wallet to continue.')
        }
    }, [disconnectAsync])

    const requireReadyMarketplace = useCallback((): Address | null => {
        if (!typedAddress) {
            setMarketplaceStatus('Marketplace contract address is not configured.')
            return null
        }

        if (!isConnected) {
            setMarketplaceStatus('Connect your wallet to interact with the marketplace contract.')
            return null
        }

        if (pendingAction) {
            setMarketplaceStatus('Please wait for the current transaction to complete.')
            return null
        }

        return typedAddress
    }, [typedAddress, isConnected, pendingAction])

    const handlePostTask = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const addressToUse = requireReadyMarketplace()
            if (!addressToUse) {
                return
            }

            try {
                const trimmedDescription = postDescription.trim()
                const trimmedDescriptionText = postDescriptionText.trim()

                if (!trimmedDescription && !trimmedDescriptionText) {
                    setMarketplaceStatus(
                        'Provide an IPFS content identifier or enter description text to generate one.',
                    )
                    return
                }

                let descriptionReference = trimmedDescription
                    ? normalizeContentReference(trimmedDescription)
                    : ''
                let usedBrowserHash = false

                if (!descriptionReference) {
                    try {
                        descriptionReference = await computeIpfsReference(trimmedDescriptionText)
                        usedBrowserHash = true
                    } catch (error) {
                        console.error(error)
                        setMarketplaceStatus(
                            'Failed to generate an IPFS content identifier for the task description text.',
                        )
                        return
                    }
                }

                if (trimmedDescription && trimmedDescriptionText) {
                    try {
                        const expectedHash = await computeIpfsReference(trimmedDescriptionText)
                        if (expectedHash !== normalizeContentReference(trimmedDescription)) {
                            setMarketplaceStatus(
                                'Warning: provided description reference does not match the generated IPFS CID from the text. Using the provided reference.',
                            )
                        }
                    } catch (error) {
                        console.error(error)
                    }
                }

                if (!postBounty || Number(postBounty) <= 0) {
                    setMarketplaceStatus('Bounty must be greater than 0.')
                    return
                }

                if (!postSolveWindowDays || Number(postSolveWindowDays) <= 0) {
                    setMarketplaceStatus('Provide the number of days solvers have to work on the task.')
                    return
                }

                const normalizedSolveWindow = Math.floor(Number(postSolveWindowDays))
                if (normalizedSolveWindow <= 0) {
                    setMarketplaceStatus('Solve window must be at least 1 day.')
                    return
                }

                const value = parseEther(postBounty)
                const solveWindowArg = BigInt(normalizedSolveWindow)
                setTxHash(undefined)
                setMarketplaceStatus(
                    usedBrowserHash
                        ? 'Description text converted to an IPFS CID locally. Submitting task to the marketplace contract...'
                        : 'Submitting task to the marketplace contract...',
                )
                setPendingAction('Preparing transaction...')

                const hash = await writeContractAsync({
                    abi: marketplaceAbi,
                    address: addressToUse,
                    functionName: 'postTask',
                    args: [descriptionReference, solveWindowArg],
                    value,
                })

                setMarketplaceStatus('Transaction submitted. Awaiting confirmation...')
                setPendingAction('Awaiting confirmation...')
                setTxHash(hash)
                setPostDescription('')
                setPostDescriptionText('')
            } catch (error) {
                console.error(error)
                setMarketplaceStatus(error instanceof Error ? error.message : 'Failed to post task.')
                setPendingAction(null)
            }
        },
        [
            requireReadyMarketplace,
            postDescription,
            postDescriptionText,
            postBounty,
            postSolveWindowDays,
            computeIpfsReference,
            normalizeContentReference,
            writeContractAsync,
        ],
    )

    const handleSubmitSolution = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const addressToUse = requireReadyMarketplace()
            if (!addressToUse) {
                return
            }

            try {
                if (!submitTaskId) {
                    setMarketplaceStatus('Enter the task ID you want to submit a solution for.')
                    return
                }

                const taskIdValue = BigInt(submitTaskId)
                const trimmedSolution = submitSolutionHash.trim()
                const trimmedSolutionText = submitSolutionText.trim()

                if (!trimmedSolution && !trimmedSolutionText) {
                    setMarketplaceStatus(
                        'Provide an IPFS content identifier for the solution or enter solution text to generate one.',
                    )
                    return
                }

                let solutionReference = trimmedSolution
                    ? normalizeContentReference(trimmedSolution)
                    : ''
                let usedBrowserHash = false

                if (!solutionReference) {
                    try {
                        solutionReference = await computeIpfsReference(trimmedSolutionText)
                        usedBrowserHash = true
                    } catch (error) {
                        console.error(error)
                        setMarketplaceStatus(
                            'Failed to generate an IPFS content identifier for the solution text.',
                        )
                        return
                    }
                }

                if (trimmedSolution && trimmedSolutionText) {
                    try {
                        const expectedHash = await computeIpfsReference(trimmedSolutionText)
                        if (expectedHash !== normalizeContentReference(trimmedSolution)) {
                            setMarketplaceStatus(
                                'Warning: provided solution reference does not match the generated IPFS CID from the text. Using the provided reference.',
                            )
                        }
                    } catch (error) {
                        console.error(error)
                    }
                }

                if (!submitCostWei || submitCostWei === 0n) {
                    setMarketplaceStatus('Unable to determine the required submission stake from the contract.')
                    return
                }

                setTxHash(undefined)
                setMarketplaceStatus(
                    usedBrowserHash
                        ? 'Solution text converted to an IPFS CID locally. Submitting solution to the marketplace...'
                        : 'Submitting solution. Confirm the transaction in your wallet...',
                )
                setPendingAction('Preparing transaction...')

                const hash = await writeContractAsync({
                    abi: marketplaceAbi,
                    address: addressToUse,
                    functionName: 'submitSolution',
                    args: [taskIdValue, solutionReference],
                    value: submitCostWei,
                })

                setMarketplaceStatus('Solution submitted. Awaiting confirmation...')
                setPendingAction('Awaiting confirmation...')
                setTxHash(hash)
                setSubmitSolutionHash('')
                setSubmitSolutionText('')
            } catch (error) {
                console.error(error)
                setMarketplaceStatus(
                    error instanceof Error ? error.message : 'Failed to submit solution.',
                )
                setPendingAction(null)
            }
        },
        [
            requireReadyMarketplace,
            submitTaskId,
            submitSolutionHash,
            submitSolutionText,
            submitCostWei,
            computeIpfsReference,
            normalizeContentReference,
            writeContractAsync,
        ],
    )

    const handleVerifySolution = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const addressToUse = requireReadyMarketplace()
            if (!addressToUse) {
                return
            }

            try {
                if (!verifyTaskId) {
                    setMarketplaceStatus('Enter the task ID you want to verify.')
                    return
                }

                if (!verifyCostWei || verifyCostWei === 0n) {
                    setMarketplaceStatus('Unable to determine the required verification stake from the contract.')
                    return
                }

                const taskIdValue = BigInt(verifyTaskId)
                const isApproved = verifyApproval === 'approved'

                setTxHash(undefined)
                setMarketplaceStatus('Submitting verification transaction...')
                setPendingAction('Preparing transaction...')

                const hash = await writeContractAsync({
                    abi: marketplaceAbi,
                    address: addressToUse,
                    functionName: 'verifySolution',
                    args: [taskIdValue, isApproved],
                    value: verifyCostWei,
                })

                setMarketplaceStatus('Verification submitted. Awaiting confirmation...')
                setPendingAction('Awaiting confirmation...')
                setTxHash(hash)
            } catch (error) {
                console.error(error)
                setMarketplaceStatus(
                    error instanceof Error ? error.message : 'Failed to verify the solution.',
                )
                setPendingAction(null)
            }
        },
        [requireReadyMarketplace, verifyTaskId, verifyCostWei, verifyApproval, writeContractAsync],
    )

    const handleJurorVote = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const addressToUse = requireReadyMarketplace()
            if (!addressToUse) {
                return
            }

            try {
                if (!jurorTaskId) {
                    setMarketplaceStatus('Enter the disputed task ID you want to vote on as a juror.')
                    return
                }

                const taskIdValue = BigInt(jurorTaskId)
                const trimmedStake = jurorStakeAmount.trim()

                if (!trimmedStake) {
                    setMarketplaceStatus('Enter the number of governance tokens you want to stake when voting.')
                    return
                }

                let normalizedStake: bigint

                try {
                    normalizedStake = supportsTokenDecimals
                        ? parseUnits(trimmedStake, Number(governanceTokenDecimals))
                        : BigInt(trimmedStake)
                } catch (error) {
                    console.error(error)
                    setMarketplaceStatus('Enter a valid token amount to stake when voting as a juror.')
                    return
                }

                if (normalizedStake <= 0n) {
                    setMarketplaceStatus('Stake amount must be greater than zero.')
                    return
                }

                if (minJurorStake && normalizedStake < minJurorStake) {
                    setMarketplaceStatus(
                        'Stake amount must meet or exceed the minimum juror stake defined by the contract.',
                    )
                    return
                }

                setTxHash(undefined)
                setMarketplaceStatus('Submitting juror vote. Confirm the transaction in your wallet...')
                setPendingAction('Preparing transaction...')

                const hash = await writeContractAsync({
                    abi: marketplaceAbi,
                    address: addressToUse,
                    functionName: 'jurorVote',
                    args: [taskIdValue, normalizedStake, jurorVoteChoice === 'supports'],
                })

                setMarketplaceStatus('Juror vote submitted. Awaiting confirmation...')
                setPendingAction('Awaiting confirmation...')
                setTxHash(hash)
                setJurorStakeAmount('')
            } catch (error) {
                console.error(error)
                setMarketplaceStatus(
                    error instanceof Error ? error.message : 'Failed to submit the juror vote transaction.',
                )
                setPendingAction(null)
            }
        },
        [
            requireReadyMarketplace,
            jurorTaskId,
            jurorStakeAmount,
            supportsTokenDecimals,
            governanceTokenDecimals,
            minJurorStake,
            jurorVoteChoice,
            writeContractAsync,
        ],
    )

    const handleFinalizeTask = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const addressToUse = requireReadyMarketplace()
            if (!addressToUse) {
                return
            }

            try {
                if (!finalizeTaskId) {
                    setMarketplaceStatus('Enter the task ID you want to finalize.')
                    return
                }

                const taskIdValue = BigInt(finalizeTaskId)
                setTxHash(undefined)
                setMarketplaceStatus('Sending finalize transaction...')
                setPendingAction('Preparing transaction...')

                const hash = await writeContractAsync({
                    abi: marketplaceAbi,
                    address: addressToUse,
                    functionName: 'finalizeTask',
                    args: [taskIdValue],
                })

                setMarketplaceStatus('Finalize transaction submitted. Awaiting confirmation...')
                setPendingAction('Awaiting confirmation...')
                setTxHash(hash)
            } catch (error) {
                console.error(error)
                setMarketplaceStatus(
                    error instanceof Error ? error.message : 'Failed to finalize the task.',
                )
                setPendingAction(null)
            }
        },
        [requireReadyMarketplace, finalizeTaskId, writeContractAsync],
    )

    const handleFetchTask = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!typedAddress) {
                setMarketplaceStatus('Marketplace contract address is not configured.')
                return
            }

            try {
                if (!lookupTaskId) {
                    setMarketplaceStatus('Enter a task ID to look up details.')
                    return
                }

                const taskIdValue = BigInt(lookupTaskId)
                setMarketplaceStatus('Fetching task details from the contract...')

                const result = (await readContract(config, {
                    abi: marketplaceAbi,
                    address: typedAddress,
                    functionName: 'getTask',
                    args: [taskIdValue],
                })) as readonly [
                    Address,
                    Address,
                    Address,
                    bigint,
                    string,
                    string,
                    bigint,
                    boolean,
                    bigint,
                        number | bigint,
                ]

                const statusIndex = Number(result[9])

                setFetchedTask({
                    id: taskIdValue,
                    creator: result[0],
                    solver: result[1],
                    verifier: result[2],
                    bountyWei: result[3],
                    descriptionHash: result[4],
                    solutionHash: result[5],
                    solveDeadline: result[6],
                    approved: result[7],
                    deadline: result[8],
                    statusIndex,
                })

                setMarketplaceStatus('Task data loaded.')
            } catch (error) {
                console.error(error)
                setFetchedTask(null)
                setMarketplaceStatus(error instanceof Error ? error.message : 'Unable to load task.')
            }
        },
        [lookupTaskId, typedAddress],
    )

    const handleRefreshTaskCount = useCallback(async () => {
        if (!typedAddress) {
            setMarketplaceStatus('Marketplace contract address is not configured.')
            return
        }

        setMarketplaceStatus('Refreshing task count...')
        const result = await refetchTaskCount()

        if (result.error) {
            const message =
                result.error instanceof Error ? result.error.message : 'Failed to refresh task count.'
            setMarketplaceStatus(message)
            return
        }

        setMarketplaceStatus('Task count updated.')
    }, [typedAddress, refetchTaskCount])

    const taskCountDisplay = typedAddress
        ? taskCountData?.toString() ?? (isTaskCountFetching ? 'Loading…' : '0')
        : '—'

    const handleFetchOpenTasks = useCallback(async () => {
        if (!typedAddress) {
            setOpenTasks([])
            setOpenTasksError('Marketplace contract address is not configured.')
            return
        }

        setIsFetchingOpenTasks(true)
        setOpenTasksError(null)

        try {
            let totalTasks = taskCountData

            if (typeof totalTasks === 'undefined') {
                const result = await refetchTaskCount()

                if (result.error) {
                    throw result.error
                }

                totalTasks = result.data
            }

            if (!totalTasks || totalTasks === 0n) {
                setOpenTasks([])
                return
            }

            const taskIds = Array.from({ length: Number(totalTasks) }, (_, index) => BigInt(index + 1))

            const tasks = await Promise.all(
                taskIds.map(async (taskId) => {
                    const result = (await readContract(config, {
                        abi: marketplaceAbi,
                        address: typedAddress,
                        functionName: 'getTask',
                        args: [taskId],
                    })) as readonly [
                        Address,
                        Address,
                        Address,
                        bigint,
                        string,
                        string,
                        bigint,
                        boolean,
                        bigint,
                            number | bigint,
                    ]

                    const statusIndex = Number(result[9])

                    return {
                        id: taskId,
                        creator: result[0],
                        solver: result[1],
                        verifier: result[2],
                        bountyWei: result[3],
                        descriptionHash: result[4],
                        solutionHash: result[5],
                        solveDeadline: result[6],
                        approved: result[7],
                        deadline: result[8],
                        statusIndex,
                    } satisfies UiTask
                }),
            )

            const openTaskList = tasks.filter((task) => task.statusIndex === 0)
            setOpenTasks(openTaskList)
        } catch (error) {
            console.error(error)
            setOpenTasks([])
            setOpenTasksError(error instanceof Error ? error.message : 'Unable to load open tasks.')
        } finally {
            setIsFetchingOpenTasks(false)
        }
    }, [typedAddress, taskCountData, refetchTaskCount])

    useEffect(() => {
        if (!typedAddress) {
            setOpenTasks([])
            return
        }

        if (typeof taskCountData === 'undefined') {
            return
        }

        void handleFetchOpenTasks()
    }, [typedAddress, taskCountData, handleFetchOpenTasks])

    const isAuthenticated = isConnected

    return (
        <div className="container">
            <header>
                <h1>Wallet-authenticated Task Marketplace</h1>
                <p>Connect your wallet to unlock the on-chain utilities below.</p>
            </header>

            {!isAuthenticated && (
                <section className="card intro-card">
                    <h2>Start by connecting your wallet</h2>
                    <p className="muted">
                        Use MetaMask or another injected wallet to access the marketplace tools.
                    </p>
                </section>
            )}

            <section className="card">
                <h2>Wallet connection</h2>
                {isConnected ? (
                    <>
                        <p className="muted">Connected wallet: {address}</p>
                        <div className="button-row">
                            <button onClick={handleDisconnect} disabled={isDisconnecting} className="secondary">
                                {isDisconnecting ? 'Disconnecting...' : 'Disconnect wallet'}
                            </button>
                        </div>
                    </>
                ) : (
                    <button onClick={handleConnect} disabled={isConnecting || !activeConnector}>
                        {isConnecting ? 'Connecting...' : 'Connect MetaMask / Injected Wallet'}
                    </button>
                )}
            </section>

            <section className="card">
                <h2>Authentication status</h2>
                <p className="status">{authStatus}</p>
                {isConnected && (
                    <p className="muted">
                        Authenticated wallet address: <code>{address}</code>
                    </p>
                )}
            </section>

            {isAuthenticated && (
                <section className="card marketplace-card">
                    <h2>Task Marketplace utilities</h2>
                    <p className="muted">
                        Using deployed <code>TaskMarketplace</code> at{' '}
                        <code>{MARKETPLACE_ADDRESS}</code>. Use these helpers to post tasks, submit solutions,
                        verify work, and inspect stored task data.
                    </p>

                    <div className="status-panel">
                        <p className="status">{marketplaceStatus}</p>
                        {pendingAction && <p className="muted">Current action: {pendingAction}</p>}
                        {isWaitingReceipt && <p className="muted">Waiting for on-chain confirmation…</p>}
                        {txHash && (
                            <p className="muted">
                                Latest transaction hash: <code>{txHash}</code>
                            </p>
                        )}
                    </div>

                    <div className="task-summary">
                        <div>
                            <strong>Total tasks:</strong> {taskCountDisplay}
                        </div>
                        <button
                            type="button"
                            onClick={handleRefreshTaskCount}
                            disabled={!typedAddress || isTaskCountFetching}
                        >
                            {isTaskCountFetching ? 'Refreshing…' : 'Refresh count'}
                        </button>
                    </div>

                    <div className="open-tasks-section">
                        <div className="open-tasks-header">
                            <h3 className="open-tasks-title">Open tasks</h3>
                            <button
                                type="button"
                                onClick={handleFetchOpenTasks}
                                disabled={!typedAddress || isFetchingOpenTasks}
                            >
                                {isFetchingOpenTasks ? 'Loading…' : 'Refresh open tasks'}
                            </button>
                        </div>
                        <div className="open-tasks-list">
                            {openTasksError && <p className="error-text">{openTasksError}</p>}
                            {isFetchingOpenTasks && !openTasksError && (
                                <p className="muted">Loading open tasks…</p>
                            )}
                            {!openTasksError && openTasks.length === 0 && !isFetchingOpenTasks && (
                                <p className="muted">No open tasks found.</p>
                            )}
                            {!openTasksError && openTasks.length > 0 && (
                                <ul>
                                    {openTasks.map((task) => (
                                        <li key={task.id.toString()} className="open-task-item">
                                            <div className="open-task-heading">
                                                <span className="open-task-id">Task #{task.id.toString()}</span>
                                                <span className="open-task-bounty">
                          {formatEther(task.bountyWei)} ETH bounty
                        </span>
                                            </div>
                                            <div className="open-task-meta">
                        <span>
                          Creator: <code>{task.creator}</code>
                        </span>
                                                <span>
                          Solve deadline:{' '}
                                                    {task.solveDeadline === 0n
                                                        ? '—'
                                                        : new Date(Number(task.solveDeadline) * 1000).toLocaleString()}
                        </span>
                                            </div>
                                            <div className="open-task-description">
                                                <span>Description reference:</span>
                                                <code>{task.descriptionHash || '—'}</code>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <h3>Post a new task</h3>
                    <form className="form-grid" onSubmit={handlePostTask}>
                        <div className="field-group full-width">
                            <label htmlFor="postDescriptionText">Description text (optional)</label>
                            <textarea
                                id="postDescriptionText"
                                placeholder="Describe the work you want completed"
                                rows={4}
                                value={postDescriptionText}
                                onChange={(event) => setPostDescriptionText(event.target.value)}
                            />
                            <small className="hint">
                                We'll generate an IPFS CID for this text in your browser if you leave the
                                description reference field empty.
                            </small>
                            {generatedDescriptionHash && (
                                <div className="hash-preview">
                                    <div className="hash-preview-value">
                                        <span>Preview CID:</span>
                                        <code>{generatedDescriptionHash}</code>
                                    </div>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setPostDescription(generatedDescriptionHash)}
                                    >
                                        Use this CID above
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="field-group">
                            <label htmlFor="postDescription">Description reference (CID or hash)</label>
                            <input
                                id="postDescription"
                                placeholder="ipfs://cid or 0x reference"
                                value={postDescription}
                                onChange={(event) => setPostDescription(event.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="postBounty">Bounty (ETH)</label>
                            <input
                                id="postBounty"
                                type="number"
                                min="0"
                                step="0.0001"
                                value={postBounty}
                                onChange={(event) => setPostBounty(event.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="postSolveWindow">Solve window (days)</label>
                            <input
                                id="postSolveWindow"
                                type="number"
                                min="1"
                                step="1"
                                value={postSolveWindowDays}
                                onChange={(event) => setPostSolveWindowDays(event.target.value)}
                            />
                            <small className="hint">
                                Determines how long solvers have before the on-chain deadline.
                            </small>
                        </div>
                        <button
                            type="submit"
                            disabled={!typedAddress || !isConnected || Boolean(pendingAction)}
                        >
                            Post task
                        </button>
                    </form>

                    <h3>Submit a solution</h3>
                    <form className="form-grid" onSubmit={handleSubmitSolution}>
                        <div className="field-group">
                            <label htmlFor="submitTaskId">Task ID</label>
                            <input
                                id="submitTaskId"
                                type="number"
                                min="1"
                                step="1"
                                value={submitTaskId}
                                onChange={(event) => setSubmitTaskId(event.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="submitStake">Required stake (ETH)</label>
                            <input
                                id="submitStake"
                                value={submitStakeLabel ?? ''}
                                placeholder={
                                    isSubmitCostFetching
                                        ? 'Loading stake amount...'
                                        : 'Connect to a marketplace contract to load'
                                }
                                readOnly
                            />
                        </div>
                        <div className="field-group full-width">
                            <label htmlFor="submitSolutionText">Solution text (optional)</label>
                            <textarea
                                id="submitSolutionText"
                                placeholder="Paste the solution details or reference"
                                rows={4}
                                value={submitSolutionText}
                                onChange={(event) => setSubmitSolutionText(event.target.value)}
                            />
                            <small className="hint">
                                We'll generate an IPFS CID for this text in your browser if the solution reference
                                field is empty.
                            </small>
                            {generatedSolutionHash && (
                                <div className="hash-preview">
                                    <div className="hash-preview-value">
                                        <span>Preview CID:</span>
                                        <code>{generatedSolutionHash}</code>
                                    </div>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setSubmitSolutionHash(generatedSolutionHash)}
                                    >
                                        Use this CID above
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="field-group">
                            <label htmlFor="submitSolutionHash">Solution reference (CID or hash)</label>
                            <input
                                id="submitSolutionHash"
                                placeholder="ipfs://cid or 0x reference"
                                value={submitSolutionHash}
                                onChange={(event) => setSubmitSolutionHash(event.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!typedAddress || !isConnected || Boolean(pendingAction)}
                        >
                            Submit solution
                        </button>
                    </form>

                    <h3>Verify a submitted solution</h3>
                    <form className="form-grid" onSubmit={handleVerifySolution}>
                        <div className="field-group">
                            <label htmlFor="verifyTaskId">Task ID</label>
                            <input
                                id="verifyTaskId"
                                type="number"
                                min="1"
                                step="1"
                                value={verifyTaskId}
                                onChange={(event) => setVerifyTaskId(event.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="verifyStake">Required stake (ETH)</label>
                            <input
                                id="verifyStake"
                                value={verifyStakeLabel ?? ''}
                                placeholder={
                                    isVerifyCostFetching
                                        ? 'Loading stake amount...'
                                        : 'Connect to a marketplace contract to load'
                                }
                                readOnly
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="verifyApproval">Decision</label>
                            <select
                                id="verifyApproval"
                                value={verifyApproval}
                                onChange={(event) =>
                                    setVerifyApproval(event.target.value as 'approved' | 'rejected')
                                }
                            >
                                <option value="approved">Approve solution</option>
                                <option value="rejected">Reject solution</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={!typedAddress || !isConnected || Boolean(pendingAction)}
                        >
                            Verify solution
                        </button>
                    </form>

                    <h3>Participate in juror voting</h3>
                    <form className="form-grid" onSubmit={handleJurorVote}>
                        <div className="field-group">
                            <label htmlFor="jurorTaskId">Disputed task ID</label>
                            <input
                                id="jurorTaskId"
                                type="number"
                                min="1"
                                step="1"
                                value={jurorTaskId}
                                onChange={(event) => setJurorTaskId(event.target.value)}
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="jurorTokenAddress">Governance token contract</label>
                            <input
                                id="jurorTokenAddress"
                                value={resolvedGovernanceTokenAddress ?? ''}
                                placeholder={
                                    typedAddress ? 'Loading governance token...' : 'Connect to a marketplace first'
                                }
                                readOnly
                            />
                            <small className="hint">
                                Approve this token for the marketplace contract before submitting a juror vote.
                            </small>
                        </div>
                        <div className="field-group">
                            <label htmlFor="jurorMinStake">Minimum stake ({governanceTokenSymbolLabel})</label>
                            <input
                                id="jurorMinStake"
                                value={minJurorStakeLabel ?? ''}
                                placeholder={
                                    typedAddress ? 'Loading minimum stake...' : 'Connect to view requirements'
                                }
                                readOnly
                            />
                        </div>
                        <div className="field-group">
                            <label htmlFor="jurorStakeAmount">
                                Stake amount ({governanceTokenSymbolLabel})
                            </label>
                            <input
                                id="jurorStakeAmount"
                                type="text"
                                inputMode="decimal"
                                value={jurorStakeAmount}
                                onChange={(event) => setJurorStakeAmount(event.target.value)}
                                placeholder={supportsTokenDecimals ? '0.0' : 'Enter integer token amount'}
                            />
                            <small className="hint">
                                {supportsTokenDecimals
                                    ? `Values are converted using ${governanceTokenDecimals} decimals.`
                                    : 'Decimals unavailable; enter the raw integer token amount.'}
                            </small>
                        </div>
                        <div className="field-group">
                            <label htmlFor="jurorVoteChoice">Vote</label>
                            <select
                                id="jurorVoteChoice"
                                value={jurorVoteChoice}
                                onChange={(event) =>
                                    setJurorVoteChoice(event.target.value === 'supports' ? 'supports' : 'opposes')
                                }
                            >
                                <option value="supports">Support the verifier decision</option>
                                <option value="opposes">Oppose the verifier decision</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={!typedAddress || !isConnected || Boolean(pendingAction)}
                        >
                            Submit juror vote
                        </button>
                    </form>

                    <h3>Finalize a task</h3>
                    <form className="form-grid" onSubmit={handleFinalizeTask}>
                        <div className="field-group">
                            <label htmlFor="finalizeTaskId">Task ID</label>
                            <input
                                id="finalizeTaskId"
                                type="number"
                                min="1"
                                step="1"
                                value={finalizeTaskId}
                                onChange={(event) => setFinalizeTaskId(event.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!typedAddress || !isConnected || Boolean(pendingAction)}
                        >
                            Finalize task
                        </button>
                    </form>

                    <h3>Look up task details</h3>
                    <form className="form-grid" onSubmit={handleFetchTask}>
                        <div className="field-group">
                            <label htmlFor="lookupTaskId">Task ID</label>
                            <input
                                id="lookupTaskId"
                                type="number"
                                min="1"
                                step="1"
                                value={lookupTaskId}
                                onChange={(event) => setLookupTaskId(event.target.value)}
                            />
                        </div>
                        <button type="submit" disabled={!typedAddress}>
                            Fetch task
                        </button>
                    </form>

                    {fetchedTask && (
                        <div className="task-details">
                            <h4>Task #{fetchedTask.id.toString()}</h4>
                            <dl>
                                <div>
                                    <dt>Status</dt>
                                    <dd>
                                        {TASK_STATUS_LABELS[fetchedTask.statusIndex] ??
                                            `Unknown (${fetchedTask.statusIndex})`}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Creator</dt>
                                    <dd>
                                        <code>{fetchedTask.creator}</code>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Solver</dt>
                                    <dd>
                                        <code>{fetchedTask.solver === zeroAddress ? '—' : fetchedTask.solver}</code>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Verifier</dt>
                                    <dd>
                                        <code>{fetchedTask.verifier === zeroAddress ? '—' : fetchedTask.verifier}</code>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Bounty</dt>
                                    <dd>{formatEther(fetchedTask.bountyWei)} ETH</dd>
                                </div>
                                <div>
                                    <dt>Approved</dt>
                                    <dd>{fetchedTask.approved ? 'Yes' : 'No'}</dd>
                                </div>
                                <div>
                                    <dt>Solve deadline</dt>
                                    <dd>
                                        {fetchedTask.solveDeadline === 0n
                                            ? 'No solve deadline set'
                                            : new Date(Number(fetchedTask.solveDeadline) * 1000).toLocaleString()}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Review deadline</dt>
                                    <dd>
                                        {fetchedTask.deadline === 0n
                                            ? 'No review deadline set'
                                            : new Date(Number(fetchedTask.deadline) * 1000).toLocaleString()}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Description reference</dt>
                                    <dd>
                                        <code>{fetchedTask.descriptionHash || '—'}</code>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Solution reference</dt>
                                    <dd>
                                        <code>{fetchedTask.solutionHash || '—'}</code>
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}

export default App
