import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { parseEther, formatEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import dayjs from "dayjs";
import { useQuery, gql } from "@apollo/client";
import {
  NativeAssetSuperToken,
  Operation,
  Framework,
} from "@superfluid-finance/sdk-core";
import duration from "dayjs/plugin/duration";
import Accordion from "react-bootstrap/Accordion";
import Stack from "react-bootstrap/Stack";
import { Step } from "@/types/checkout";
import EditStream from "@/components/checkout/EditStream";
import TopUp from "@/components/checkout/TopUp";
import Wrap from "@/components/checkout/Wrap";
import FlowStateCoreGraph from "@/components/FlowStateCoreGraph";
import Review from "@/components/checkout/Review";
import Success from "@/components/checkout/Success";
import FlowStateCoreDetails from "@/components/FlowStateCoreDetails";
import { useMediaQuery } from "@/hooks/mediaQuery";
import useFlowingAmount from "@/hooks/flowingAmount";
import useTransactionsQueue from "@/hooks/transactionsQueue";
import { useEthersProvider, useEthersSigner } from "@/hooks/ethersAdapters";
import { getApolloClient } from "@/lib/apollo";
import { networks } from "@/lib/networks";
import {
  TimeInterval,
  unitOfTime,
  fromTimeUnitsToSeconds,
  formatNumberWithCommas,
  roundWeiAmount,
} from "@/lib/utils";
import { SECONDS_IN_MONTH, DEFAULT_CHAIN_ID } from "@/lib/constants";

const FLOW_STATE_CORE_QUERY = gql`
  query FlowStateCoreQuery($gdaPool: String!, $userAddress: String!) {
    pool(id: $gdaPool) {
      id
      flowRate
      adjustmentFlowRate
      totalAmountFlowedDistributedUntilUpdatedAt
      updatedAtTimestamp
      totalUnits
      token {
        id
      }
      poolMembers {
        account {
          id
        }
        units
      }
      poolDistributors(where: { flowRate_not: "0" }) {
        account {
          id
        }
        flowRate
        totalAmountFlowedDistributedUntilUpdatedAt
        updatedAtTimestamp
      }
    }
    account(id: $userAddress) {
      accountTokenSnapshots {
        totalNetFlowRate
        totalOutflowRate
        totalDeposit
        maybeCriticalAtTimestamp
        balanceUntilUpdatedAt
        updatedAtTimestamp
        token {
          id
        }
      }
      outflows(
        where: { token: $token }
        orderBy: updatedAtTimestamp
        orderDirection: desc
      ) {
        receiver {
          id
        }
        streamedUntilUpdatedAt
        updatedAtTimestamp
        currentFlowRate
      }
    }
  }
`;

dayjs().format();
dayjs.extend(duration);

export default function FlowStateCore() {
  const [step, setStep] = useState<Step>(Step.SELECT_AMOUNT);
  const [amountPerTimeInterval, setAmountPerTimeInterval] = useState("");
  const [timeInterval, setTimeInterval] = useState<TimeInterval>(
    TimeInterval.MONTH,
  );
  const [newFlowRate, setNewFlowRate] = useState("");
  const [wrapAmount, setWrapAmount] = useState("");
  const [transactions, setTransactions] = useState<(() => Promise<void>)[]>([]);

  const router = useRouter();
  const chainId = router.query.chainId
    ? Number(router.query.chainId)
    : DEFAULT_CHAIN_ID;
  const network =
    networks.find((network) => network.id === chainId) ?? networks[0];
  const { isMobile, isTablet } = useMediaQuery();
  const { address } = useAccount();
  const {
    areTransactionsLoading,
    completedTransactions,
    transactionError,
    executeTransactions,
  } = useTransactionsQueue();
  const { data: ethBalance } = useBalance({
    address,
    chainId,
    query: {
      refetchInterval: 10000,
    },
  });
  const { data: superfluidQueryRes } = useQuery(FLOW_STATE_CORE_QUERY, {
    client: getApolloClient("superfluid", chainId),
    variables: {
      gdaPool: network.flowStateCoreGda.toLowerCase(),
      userAddress: address?.toLowerCase() ?? "",
    },
    pollInterval: 10000,
  });
  const ethersProvider = useEthersProvider({ chainId: network.id });
  const ethersSigner = useEthersSigner({ chainId: network.id });

  const userAccountSnapshot =
    superfluidQueryRes?.account?.accountTokenSnapshots?.find(
      (snapshot: { token: { id: string } }) =>
        snapshot.token.id === network.tokens[0].address.toLowerCase(),
    ) ?? null;
  const superTokenBalance = useFlowingAmount(
    BigInt(userAccountSnapshot?.balanceUntilUpdatedAt ?? 0),
    userAccountSnapshot?.updatedAtTimestamp ?? 0,
    BigInt(userAccountSnapshot?.totalNetFlowRate ?? 0),
  );
  const minEthBalance = 0.001;
  const suggestedTokenBalance = newFlowRate
    ? BigInt(newFlowRate) * BigInt(SECONDS_IN_MONTH) * BigInt(3)
    : BigInt(0);
  const hasSufficientEthBalance =
    ethBalance && ethBalance.value > parseEther(minEthBalance.toString())
      ? true
      : false;
  const hasSuggestedTokenBalance = superTokenBalance > suggestedTokenBalance;
  const hasSufficientTokenBalance =
    (ethBalance && ethBalance.value + superTokenBalance > BigInt(0)) ||
    superTokenBalance > BigInt(0)
      ? true
      : false;

  const flowRateToReceiver = useMemo(() => {
    if (address && superfluidQueryRes?.pool) {
      const distributor = superfluidQueryRes.pool.poolDistributors.find(
        (distributor: { account: { id: string } }) =>
          distributor.account.id === address.toLowerCase(),
      );

      if (distributor) {
        return distributor.flowRate;
      }
    }

    return "0";
  }, [address, superfluidQueryRes]);

  const calcLiquidationEstimate = useCallback(
    (amountPerTimeInterval: string, timeInterval: TimeInterval) => {
      if (address) {
        const newFlowRate =
          parseEther(amountPerTimeInterval.replace(/,/g, "")) /
          BigInt(fromTimeUnitsToSeconds(1, unitOfTime[timeInterval]));
        const accountFlowRate = userAccountSnapshot?.totalNetFlowRate ?? "0";

        if (
          BigInt(-accountFlowRate) -
            BigInt(flowRateToReceiver) +
            BigInt(newFlowRate) >
          BigInt(0)
        ) {
          const updatedAtTimestamp = userAccountSnapshot
            ? userAccountSnapshot.updatedAtTimestamp * 1000
            : Date.now();
          const date = dayjs(new Date(updatedAtTimestamp));

          return date
            .add(
              dayjs.duration({
                seconds: Number(
                  (BigInt(userAccountSnapshot?.balanceUntilUpdatedAt ?? "0") +
                    parseEther(wrapAmount?.replace(/,/g, "") ?? "0")) /
                    (BigInt(-accountFlowRate) -
                      BigInt(flowRateToReceiver) +
                      BigInt(newFlowRate)),
                ),
              }),
            )
            .unix();
        }
      }

      return null;
    },
    [userAccountSnapshot, address, wrapAmount, flowRateToReceiver],
  );

  const liquidationEstimate = useMemo(
    () => calcLiquidationEstimate(amountPerTimeInterval, timeInterval),
    [calcLiquidationEstimate, amountPerTimeInterval, timeInterval],
  );

  useEffect(() => {
    (async () => {
      if (!address || !newFlowRate || !ethersProvider || !ethersSigner) {
        return;
      }

      const wrapAmountWei = parseEther(wrapAmount?.replace(/,/g, "") ?? "0");
      const transactions: (() => Promise<void>)[] = [];
      const operations: Operation[] = [];

      const sfFramework = await Framework.create({
        chainId: network.id,
        resolverAddress: network.superfluidResolver,
        provider: ethersProvider,
      });
      const superToken = await sfFramework.loadSuperToken("ETHx");

      if (wrapAmount && Number(wrapAmount?.replace(/,/g, "")) > 0) {
        transactions.push(async () => {
          const tx = await (superToken as NativeAssetSuperToken)
            .upgrade({
              amount: wrapAmountWei.toString(),
            })
            .exec(ethersSigner);

          await tx.wait();
        });
      }

      operations.push(
        superToken.distributeFlow({
          from: address,
          pool: network.flowStateCoreGda,
          requestedFlowRate: newFlowRate,
        }),
      );

      transactions.push(async () => {
        const tx = await sfFramework.batchCall(operations).exec(ethersSigner);

        await tx.wait();
      });

      setTransactions(transactions);
    })();
  }, [address, network, wrapAmount, newFlowRate, ethersProvider, ethersSigner]);

  const graphComponentKey = useMemo(
    () => `${superfluidQueryRes?.pool.id ?? ""}-${Date.now()}`,
    [superfluidQueryRes?.pool],
  );

  useEffect(() => {
    (async () => {
      const currentStreamValue = roundWeiAmount(
        BigInt(flowRateToReceiver) * BigInt(SECONDS_IN_MONTH),
        4,
      );

      setAmountPerTimeInterval(
        formatNumberWithCommas(parseFloat(currentStreamValue)),
      );
    })();
  }, [address, flowRateToReceiver, timeInterval]);

  useEffect(() => {
    if (!areTransactionsLoading && amountPerTimeInterval) {
      setNewFlowRate(
        (
          parseEther(amountPerTimeInterval.replace(/,/g, "")) /
          BigInt(fromTimeUnitsToSeconds(1, unitOfTime[timeInterval]))
        ).toString(),
      );
    }
  }, [areTransactionsLoading, amountPerTimeInterval, timeInterval]);

  const updateWrapAmount = (
    amountPerTimeInterval: string,
    timeInterval: TimeInterval,
    liquidationEstimate: number | null,
  ) => {
    if (amountPerTimeInterval) {
      if (
        Number(amountPerTimeInterval.replace(/,/g, "")) > 0 &&
        liquidationEstimate &&
        dayjs
          .unix(liquidationEstimate)
          .isBefore(dayjs().add(dayjs.duration({ months: 3 })))
      ) {
        setWrapAmount(
          formatNumberWithCommas(
            parseFloat(
              formatEther(
                parseEther(amountPerTimeInterval.replace(/,/g, "")) * BigInt(3),
              ),
            ),
          ),
        );
      } else {
        setWrapAmount("");
      }

      setNewFlowRate(
        (
          parseEther(amountPerTimeInterval.replace(/,/g, "")) /
          BigInt(fromTimeUnitsToSeconds(1, unitOfTime[timeInterval]))
        ).toString(),
      );
    }
  };

  return (
    <>
      {!network ? (
        <Stack direction="horizontal" className="m-auto fs-1 fs-bold">
          Network not supported
        </Stack>
      ) : (
        <Stack
          direction={isTablet ? "vertical" : "horizontal"}
          className="align-items-stretch flex-grow-1 overflow-hidden"
          style={{ height: 0 }}
        >
          {!isMobile && !isTablet && (
            <FlowStateCoreGraph
              key={graphComponentKey}
              pool={superfluidQueryRes?.pool}
              chainId={chainId}
            />
          )}
          <Stack
            direction="vertical"
            className={`${isMobile || isTablet ? "w-100" : "w-25"} p-3 mx-auto me-0 h-100 overflow-y-auto`}
            style={{
              minHeight: "100svh",
              boxShadow: "-0.4rem 0 0.4rem 1px rgba(0,0,0,0.1)",
            }}
          >
            <p className="m-0 fs-4">Fund Flow State</p>
            <Stack direction="vertical" className="flex-grow-0">
              <FlowStateCoreDetails
                matchingPool={superfluidQueryRes?.pool}
                token={network.tokens[0]}
              />
              <Accordion activeKey={step} className="mt-4">
                <EditStream
                  isSelected={step === Step.SELECT_AMOUNT}
                  setStep={(step) => setStep(step)}
                  token={network.tokens[0]}
                  network={network}
                  flowRateToReceiver={flowRateToReceiver}
                  amountPerTimeInterval={amountPerTimeInterval}
                  setAmountPerTimeInterval={(amount) => {
                    setAmountPerTimeInterval(amount);
                    updateWrapAmount(
                      amount,
                      timeInterval,
                      calcLiquidationEstimate(amount, timeInterval),
                    );
                  }}
                  newFlowRate={newFlowRate}
                  wrapAmount={wrapAmount}
                  timeInterval={timeInterval}
                  setTimeInterval={(timeInterval) => {
                    setTimeInterval(timeInterval);
                    updateWrapAmount(
                      amountPerTimeInterval,
                      timeInterval,
                      calcLiquidationEstimate(
                        amountPerTimeInterval,
                        timeInterval,
                      ),
                    );
                  }}
                  isFundingFlowStateCore={true}
                  superTokenBalance={superTokenBalance}
                  hasSufficientBalance={
                    !!hasSufficientEthBalance && !!hasSuggestedTokenBalance
                  }
                />
                <TopUp
                  step={step}
                  setStep={(step) => setStep(step)}
                  newFlowRate={newFlowRate}
                  wrapAmount={wrapAmount}
                  isFundingFlowStateCore={true}
                  superTokenBalance={superTokenBalance}
                  minEthBalance={minEthBalance}
                  suggestedTokenBalance={suggestedTokenBalance}
                  hasSufficientEthBalance={hasSufficientEthBalance}
                  hasSufficientTokenBalance={hasSufficientTokenBalance}
                  hasSuggestedTokenBalance={hasSuggestedTokenBalance}
                  ethBalance={ethBalance}
                  underlyingTokenBalance={ethBalance}
                  network={network}
                  superTokenInfo={network.tokens[0]}
                />
                <Wrap
                  step={step}
                  setStep={setStep}
                  wrapAmount={wrapAmount}
                  setWrapAmount={setWrapAmount}
                  token={network.tokens[0]}
                  isFundingFlowStateCore={true}
                  superTokenBalance={superTokenBalance}
                  underlyingTokenBalance={ethBalance}
                />
                <Review
                  step={step}
                  setStep={(step) => setStep(step)}
                  network={network}
                  receiver={network.flowStateCoreGda}
                  transactions={transactions}
                  completedTransactions={completedTransactions}
                  areTransactionsLoading={areTransactionsLoading}
                  transactionError={transactionError}
                  executeTransactions={executeTransactions}
                  liquidationEstimate={liquidationEstimate}
                  netImpact={BigInt(0)}
                  matchingTokenInfo={network.tokens[0]}
                  allocationTokenInfo={network.tokens[0]}
                  flowRateToReceiver={flowRateToReceiver}
                  amountPerTimeInterval={amountPerTimeInterval}
                  newFlowRate={newFlowRate}
                  wrapAmount={wrapAmount}
                  newFlowRateToFlowState={"0"}
                  flowRateToFlowState={"0"}
                  timeInterval={timeInterval}
                  supportFlowStateAmount={"0"}
                  supportFlowStateTimeInterval={TimeInterval.MONTH}
                  isFundingFlowStateCore={true}
                  isPureSuperToken={false}
                  superTokenBalance={superTokenBalance}
                  underlyingTokenBalance={ethBalance}
                />
                <Success
                  step={step}
                  isFundingFlowStateCore={true}
                  poolName="Flow State Core"
                  poolUiLink="https://flowstate.network/core"
                  newFlowRate={newFlowRate}
                />
              </Accordion>
            </Stack>
          </Stack>
        </Stack>
      )}
    </>
  );
}
