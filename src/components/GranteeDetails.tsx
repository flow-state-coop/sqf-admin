import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { useClampText } from "use-clamp-text";
import { createVerifiedFetch } from "@helia/verified-fetch";
import Stack from "react-bootstrap/Stack";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Image from "react-bootstrap/Image";
import Badge from "react-bootstrap/Badge";
import CopyTooltip from "@/components/CopyTooltip";
import { MatchingPool } from "@/types/matchingPool";
import { Inflow } from "@/types/inflow";
import { Outflow } from "@/types/outflow";
import { Token } from "@/types/token";
import useFlowingAmount from "../hooks/flowingAmount";
import { roundWeiAmount, formatNumberWithCommas } from "@/lib/utils";
import { SECONDS_IN_MONTH, IPFS_GATEWAYS } from "@/lib/constants";

interface GranteeDetailsProps {
  name: string;
  description: string;
  logoCid: string;
  placeholderLogo: string;
  poolUiLink: string;
  recipientAddress: string;
  inflow: Inflow;
  matchingPool: MatchingPool;
  matchingFlowRate: bigint;
  userOutflow: Outflow | null;
  allocationTokenInfo: Token;
  matchingTokenInfo: Token;
}

export default function GranteeDetails(props: GranteeDetailsProps) {
  const {
    name,
    description,
    logoCid,
    placeholderLogo,
    poolUiLink,
    recipientAddress,
    inflow,
    matchingPool,
    matchingFlowRate,
    userOutflow,
    allocationTokenInfo,
    matchingTokenInfo,
  } = props;

  const [readMore, setReadMore] = useState(true);
  const [imageUrl, setImageUrl] = useState("");

  const [descriptionRef, { noClamp, clampedText }] = useClampText({
    text: description,
    ellipsis: "...",
    expanded: readMore,
  });

  const matchingPoolMember = matchingPool?.poolMembers.find(
    (member) => member.account.id === recipientAddress,
  );
  const totalAllocatedUser = useFlowingAmount(
    BigInt(userOutflow?.streamedUntilUpdatedAt ?? 0),
    userOutflow?.updatedAtTimestamp ?? 0,
    BigInt(userOutflow?.currentFlowRate ?? 0),
  );
  const totalAllocatedOthers =
    useFlowingAmount(
      BigInt(inflow?.totalAmountStreamedInUntilUpdatedAt ?? BigInt(0)),
      inflow?.updatedAtTimestamp ?? 0,
      BigInt(inflow?.totalInflowRate ?? 0),
    ) - totalAllocatedUser;
  const totalMatching = useFlowingAmount(
    BigInt(matchingPoolMember?.totalAmountReceivedUntilUpdatedAt ?? 0),
    matchingPoolMember?.updatedAtTimestamp ?? 0,
    matchingFlowRate,
  );

  useEffect(() => {
    (async () => {
      if (!logoCid) {
        return;
      }

      try {
        const verifiedFetch = await createVerifiedFetch({
          gateways: IPFS_GATEWAYS,
        });

        const res = await verifiedFetch(`ipfs://${logoCid}`);
        const imageBlob = await res.blob();
        const imageUrl = URL.createObjectURL(imageBlob);

        setImageUrl(imageUrl);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [logoCid]);

  return (
    <Stack direction="vertical" className="bg-light rounded-4 p-2 pt-0">
      <Stack direction="horizontal" gap={2} className="align-items-start mt-3">
        <Image
          src={imageUrl === "" ? placeholderLogo : imageUrl}
          alt="logo"
          width={96}
          height={96}
          className="ms-2 rounded-4"
        />
        <Card className="bg-transparent border-0 ms-3">
          <Card.Title className="fs-6 text-secondary">{name}</Card.Title>
          <Card.Subtitle className="mb-0 fs-6">
            Your Current Stream
          </Card.Subtitle>
          <Card.Body className="d-flex align-items-center gap-2 p-0">
            <Card.Text as="span" className="fs-1">
              {formatNumberWithCommas(
                parseFloat(
                  roundWeiAmount(
                    BigInt(userOutflow?.currentFlowRate ?? 0) *
                      BigInt(SECONDS_IN_MONTH),
                    4,
                  ),
                ),
              )}
            </Card.Text>
            <Card.Text as="small" className="mt-1">
              {allocationTokenInfo.name} <br />
              per <br />
              month
            </Card.Text>
          </Card.Body>
        </Card>
      </Stack>
      <Stack
        direction="horizontal"
        gap={1}
        className="align-items-center text-secondary fs-5 p-2"
      >
        Details
        <Button
          variant="link"
          href={"https://streaming.fund"}
          target="_blank"
          rel="noreferrer"
          className="ms-1 p-0"
        >
          <Image src="/web.svg" alt="Web" width={18} height={18} />
        </Button>
        <Button
          variant="link"
          href="https://twitter.com/thegeoweb"
          target="_blank"
          rel="noreferrer"
          className="p-0"
        >
          <Image
            src="/x-logo.svg"
            alt="X Social Network"
            width={13}
            height={13}
          />
        </Button>
        <CopyTooltip
          contentClick="Link copied"
          contentHover="Copy link"
          handleCopy={() => navigator.clipboard.writeText(poolUiLink)}
          target={
            <Image
              src="/link.svg"
              alt="link"
              width={24}
              height={24}
              style={{ marginTop: 2 }}
            />
          }
        />
      </Stack>
      <Stack direction="horizontal" gap={1} className="fs-6 p-2 pb-0">
        <Stack direction="vertical" gap={1} className="w-33">
          <Card.Text className="m-0 pe-0" style={{ fontSize: "0.7rem" }}>
            You ({allocationTokenInfo.name})
          </Card.Text>
          <Badge className="bg-primary rounded-1 p-1 text-start fs-6 fw-normal">
            {formatNumberWithCommas(
              parseFloat(
                formatEther(
                  BigInt(userOutflow?.currentFlowRate ?? 0) *
                    BigInt(SECONDS_IN_MONTH),
                ).slice(0, 8),
              ),
            )}
          </Badge>
        </Stack>
        <Stack direction="vertical" gap={1} className="w-33">
          <Card.Text className="m-0 pe-0" style={{ fontSize: "0.7rem" }}>
            Others ({allocationTokenInfo.name})
          </Card.Text>
          <Badge className="bg-info rounded-1 p-1 text-start fs-6 fw-normal">
            {formatNumberWithCommas(
              parseFloat(
                formatEther(
                  (BigInt(inflow?.totalInflowRate ?? 0) -
                    BigInt(userOutflow?.currentFlowRate ?? 0)) *
                    BigInt(SECONDS_IN_MONTH),
                ).slice(0, 8),
              ),
            )}
          </Badge>
        </Stack>
        <Stack direction="vertical" gap={1} className="w-33">
          <Card.Text className="m-0 pe-0" style={{ fontSize: "0.7rem" }}>
            Matching ({matchingTokenInfo.name})
          </Card.Text>
          <Badge className="bg-secondary rounded-1 p-1 text-start fs-6 fw-normal">
            {formatNumberWithCommas(
              parseFloat(
                formatEther(matchingFlowRate * BigInt(SECONDS_IN_MONTH)).slice(
                  0,
                  8,
                ),
              ),
            )}
          </Badge>
        </Stack>
        <Card.Text className="w-20 mt-3 ms-1" style={{ fontSize: "0.7rem" }}>
          monthly
        </Card.Text>
      </Stack>
      <Stack direction="horizontal" gap={1} className="fs-6 p-2">
        <Stack direction="vertical" gap={1} className="w-33">
          <Badge className="bg-primary rounded-1 p-1 text-start fs-6 fw-normal">
            {formatNumberWithCommas(
              parseFloat(formatEther(totalAllocatedUser).slice(0, 8)),
            )}
          </Badge>
        </Stack>
        <Stack direction="vertical" gap={1} className="w-33">
          <Badge className="bg-info rounded-1 p-1 text-start fs-6 fw-normal">
            {formatNumberWithCommas(
              parseFloat(formatEther(totalAllocatedOthers).slice(0, 8)),
            )}
          </Badge>
        </Stack>
        <Stack direction="vertical" gap={1} className="w-33">
          <Badge className="bg-secondary rounded-1 p-1 text-start fs-6 fw-normal">
            {formatNumberWithCommas(
              parseFloat(formatEther(totalMatching).slice(0, 8)),
            )}
          </Badge>
        </Stack>
        <Card.Text className="w-20 ms-1" style={{ fontSize: "0.7rem" }}>
          total
        </Card.Text>
      </Stack>
      <Card.Text
        ref={descriptionRef as React.RefObject<HTMLParagraphElement>}
        className="m-0 p-2 fs-6"
        style={{ maxWidth: 500 }}
      >
        {clampedText}
      </Card.Text>
      {!noClamp && (
        <Button
          variant="transparent"
          className="p-0 border-0 shadow-none"
          onClick={() => setReadMore(!readMore)}
        >
          <Image
            src={readMore ? "/expand-less.svg" : "/expand-more.svg"}
            alt="expand"
            width={18}
          />
        </Button>
      )}
    </Stack>
  );
}
