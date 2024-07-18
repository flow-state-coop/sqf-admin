import { useState, useLayoutEffect } from "react";
import Stack from "react-bootstrap/Stack";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Image from "react-bootstrap/Image";
import Table from "react-bootstrap/Table";
import InfoTooltip from "@/components/InfoTooltip";
import { roundWeiAmount } from "@/lib/utils";
import { Pool } from "@/types/pool";
import { MatchingPool } from "@/types/matchingPool";
import { Token } from "@/types/token";
import { useMediaQuery } from "@/hooks/mediaQuery";
import useFlowingAmount from "@/hooks/flowingAmount";
import { SECONDS_IN_MONTH } from "@/lib/constants";

type PoolInfoProps = Pool & {
  allocationTokenInfo: Token;
  matchingTokenInfo: Token;
  directFlowRate: bigint;
  directTotal: bigint;
  directFunders: number;
  matchingPool: MatchingPool;
  showTransactionPanel: () => void;
};

export default function PoolInfo(props: PoolInfoProps) {
  const {
    name,
    description,
    allocationTokenInfo,
    matchingTokenInfo,
    directFlowRate,
    directTotal,
    directFunders,
    matchingPool,
    showTransactionPanel,
  } = props;

  const [showFullInfo, setShowFullInfo] = useState(false);

  const { isMobile } = useMediaQuery();

  const directMonthly = directFlowRate * BigInt(SECONDS_IN_MONTH);
  const matchingMonthly =
    BigInt(matchingPool?.flowRate ?? 0) * BigInt(SECONDS_IN_MONTH);
  const matchingTotal = useFlowingAmount(
    BigInt(matchingPool?.totalAmountFlowedDistributedUntilUpdatedAt ?? 0),
    matchingPool?.updatedAtTimestamp ?? 0,
    BigInt(matchingPool?.flowRate ?? 0),
  );
  const matchingPoolFunders =
    matchingPool?.poolDistributors?.filter(
      (distributor) => distributor.flowRate !== "0",
    ).length ?? 0;

  useLayoutEffect(() => {
    if (!showFullInfo) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  }, [showFullInfo]);

  return (
    <div className="px-4 pt-5">
      <Stack direction="vertical" className="pb-4 border-bottom">
        <Stack direction="horizontal" className="justify-content-between">
          <Stack direction="horizontal" gap={1}>
            <Card.Text className="m-0 fs-4 fw-bold">{name}</Card.Text>
            <InfoTooltip
              content=<>{description}</>
              target={
                <Image
                  src="/info.svg"
                  alt="description"
                  width={16}
                  className="mb-4"
                />
              }
            />
          </Stack>
          {isMobile && !showFullInfo && (
            <Button
              variant="transparent"
              className="p-0"
              onClick={() => setShowFullInfo(true)}
            >
              <Image src="/expand-more.svg" alt="toggle" width={48} />
            </Button>
          )}
        </Stack>
        <Card.Text className="mb-4 fs-6">Streaming Quadratic Funding</Card.Text>
        {(!isMobile || showFullInfo) && (
          <>
            <Table borderless>
              <thead className="border-bottom">
                <tr>
                  <th style={{ color: "#dee2e6" }} className="ps-0">
                    {isMobile ? "Token" : "Funding Types (Token)"}
                  </th>
                  <th style={{ color: "#dee2e6" }}>
                    {isMobile ? "Total" : "Total Flow"}
                  </th>
                  <th style={{ color: "#dee2e6" }}>
                    {isMobile ? "Monthly" : "Monthly Flow"}
                  </th>
                  <th style={{ color: "#dee2e6" }}>
                    {isMobile ? "Funders" : "Active Funders"}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="ps-0">Direct ({allocationTokenInfo.name})</td>
                  <td>{roundWeiAmount(directTotal, 2)}</td>
                  <td>{roundWeiAmount(directMonthly, 2)}</td>
                  <td>{directFunders}</td>
                </tr>
                <tr>
                  <td className="ps-0">Match ({matchingTokenInfo.name})</td>
                  <td>{roundWeiAmount(matchingTotal, 2)}</td>
                  <td>{roundWeiAmount(matchingMonthly, 2)}</td>
                  <td>{matchingPoolFunders}</td>
                </tr>
              </tbody>
            </Table>
            <Button
              variant="success"
              className="mt-3 ms-auto p-2 text-light fs-5"
              style={{ width: 180 }}
              onClick={showTransactionPanel}
            >
              Grow the Pie
            </Button>
          </>
        )}
        {isMobile && showFullInfo && (
          <Button
            variant="transparent"
            className="p-0 ms-auto mt-5"
            onClick={() => setShowFullInfo(false)}
          >
            <Image src="/expand-less.svg" alt="toggle" width={48} />
          </Button>
        )}
      </Stack>
    </div>
  );
}
