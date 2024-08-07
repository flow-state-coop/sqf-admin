import { useState, useMemo } from "react";
import { GetServerSideProps } from "next";
import { Address } from "viem";
import { useAccount, useReadContract, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { gql, useQuery } from "@apollo/client";
import Stack from "react-bootstrap/Stack";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import Image from "react-bootstrap/Image";
import Spinner from "react-bootstrap/Spinner";
import CopyTooltip from "@/components/CopyTooltip";
import useAdminParams from "@/hooks/adminParams";
import useTransactionsQueue from "@/hooks/transactionsQueue";
import { getApolloClient } from "@/lib/apollo";
import { networks } from "@/lib/networks";
import { strategyAbi } from "@/lib/abi/strategy";
import { erc20Abi } from "@/lib/abi/erc20";

type ReviewProps = {
  hostName: string;
};

type Recipient = {
  id: string;
  anchorAddress: string;
  recipientAddress: string;
  metadataCid: string;
  metadata: Metadata;
  status: Status;
};

type ReviewingRecipient = {
  id: string;
  newStatus: NewStatus;
};

type CancelingRecipient = {
  id: string;
};

type Metadata = {
  title: string;
  logoImg: string;
  bannerImg: string;
  bannerImgData: string;
  createdAt: number;
  description: string;
  website: string;
  projectTwitter: string;
  userGithub: string;
  projectGithub: string;
};

type Status = "APPROVED" | "REJECTED" | "PENDING" | "CANCELED";

enum NewStatus {
  ACCEPTED = 2,
  REJECTED = 3,
}

const RECIPIENTS_QUERY = gql`
  query RecipientsQuery($chainId: Int, $poolId: String, $address: String) {
    recipients(
      filter: {
        chainId: { equalTo: $chainId }
        poolChain: {
          poolRolesByChainIdAndPoolId: {
            some: { address: { equalTo: $address } }
          }
        }
        poolId: { equalTo: $poolId }
        tags: { contains: "allo" }
      }
    ) {
      id
      recipientAddress
      anchorAddress
      metadata
      metadataCid
      status
      poolChain {
        strategyAddress
        allocationToken
      }
    }
  }
`;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { req } = ctx;

  return { props: { hostName: req.headers.host } };
};

export default function Review(props: ReviewProps) {
  const { hostName } = props;

  const [reviewingRecipients, setReviewingRecipients] = useState<
    ReviewingRecipient[]
  >([]);
  const [cancelingRecipients, setCancelingRecipients] = useState<
    CancelingRecipient[]
  >([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(
    null,
  );
  const [transactions, setTransactions] = useState<(() => Promise<void>)[]>([]);

  const { address, chain: connectedChain } = useAccount();
  const { profileId, poolId, chainId } = useAdminParams();
  const { areTransactionsLoading, completedTransactions, executeTransactions } =
    useTransactionsQueue();
  const { data: queryRes, loading } = useQuery(RECIPIENTS_QUERY, {
    client: getApolloClient("streamingfund"),
    variables: {
      poolId,
      address: address?.toLowerCase() ?? "",
      chainId,
    },
    skip: !address || !poolId,
    pollInterval: 3000,
  });
  const { data: initialSuperAppBalance } = useReadContract({
    abi: strategyAbi,
    address: queryRes?.recipients[0]?.poolChain.strategyAddress,
    functionName: "initialSuperAppBalance",
  });
  const wagmiConfig = useConfig();

  const recipients = queryRes?.recipients ?? null;
  const allocationToken =
    recipients && recipients.length > 0
      ? (recipients[0].poolChain.allocationToken as Address)
      : null;
  const network = networks.filter((network) => network.id === chainId)[0];
  const granteeRegistrationLink = `https://${hostName}/grantee/?poolid=${poolId}&chainid=${chainId}`;

  useMemo(() => {
    if (!recipients || recipients.length === 0) {
      return;
    }

    const strategyAddress = recipients[0].poolChain.strategyAddress as Address;
    const transactions = [];

    const transferInitialSuperappBalance = async () => {
      if (!allocationToken) {
        throw Error("Allocation token not found");
      }

      if (!initialSuperAppBalance) {
        throw Error("Initial Superapp Balance not found");
      }

      const transferHash = await writeContract(wagmiConfig, {
        address: allocationToken,
        abi: erc20Abi,
        functionName: "transfer",
        args: [
          strategyAddress,
          initialSuperAppBalance * BigInt(reviewingRecipients.length),
        ],
      });

      await waitForTransactionReceipt(wagmiConfig, {
        chainId: network.id,
        hash: transferHash,
        confirmations: 2,
      });
    };

    const reviewRecipients = async () => {
      const reviewHash = await writeContract(wagmiConfig, {
        address: strategyAddress,
        abi: strategyAbi,
        functionName: "reviewRecipients",
        args: [
          reviewingRecipients.map((recipient) => recipient.id as Address),
          reviewingRecipients.map((recipient) => recipient.newStatus),
        ],
      });

      await waitForTransactionReceipt(wagmiConfig, {
        chainId: network.id,
        hash: reviewHash,
      });
    };

    const cancelRecipients = async () => {
      const cancelHash = await writeContract(wagmiConfig, {
        address: strategyAddress,
        abi: strategyAbi,
        functionName: "cancelRecipients",
        args: [
          cancelingRecipients.map((recipient) => recipient.id as `0x${string}`),
        ],
      });

      await waitForTransactionReceipt(wagmiConfig, {
        chainId: network.id,
        hash: cancelHash,
      });
    };

    if (reviewingRecipients.length > 0) {
      transactions.push(transferInitialSuperappBalance, reviewRecipients);
    }

    if (cancelingRecipients.length > 0) {
      transactions.push(cancelRecipients);
    }

    setTransactions(transactions);
  }, [
    reviewingRecipients,
    cancelingRecipients,
    initialSuperAppBalance,
    allocationToken,
    network,
    recipients,
    wagmiConfig,
  ]);

  const handleReviewSelection = (newStatus: NewStatus) => {
    if (!selectedRecipient) {
      throw Error("No selected recipient");
    }

    const _reviewingRecipients = [...reviewingRecipients];
    const index = _reviewingRecipients.findIndex(
      (recipient) => selectedRecipient.id === recipient.id,
    );

    if (index === -1) {
      _reviewingRecipients.push({
        id: selectedRecipient.id,
        newStatus,
      });
    } else {
      _reviewingRecipients[index].newStatus = newStatus;
    }

    setReviewingRecipients(_reviewingRecipients);
    setSelectedRecipient(null);
  };

  const handleCancelSelection = () => {
    if (!selectedRecipient) {
      throw Error("No selected recipient");
    }

    const _cancelingRecipients = [...cancelingRecipients];

    _cancelingRecipients.push({
      id: selectedRecipient.id,
    });

    setCancelingRecipients(_cancelingRecipients);
    setSelectedRecipient(null);
  };

  const handleSubmit = async () => {
    try {
      await executeTransactions(transactions);

      setReviewingRecipients([]);
      setCancelingRecipients([]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Stack direction="vertical" gap={4} className="px-5 py-4">
      {!profileId ? (
        <>Program not found, please select one from Program Selection</>
      ) : connectedChain?.id !== chainId ? (
        <>Wrong network</>
      ) : loading ? (
        <Spinner className="m-auto" />
      ) : (
        <Stack direction="vertical" gap={2}>
          <Card.Text className="m-0">Application Link</Card.Text>
          <Stack direction="horizontal" gap={2} className="me-auto mb-4">
            <Badge className="d-flex align-items-center bg-transparent text-black border border-2 border-gray-500 p-2 fw-normal text-start h-100">
              {granteeRegistrationLink}
            </Badge>
            <CopyTooltip
              contentClick="Link Copied"
              contentHover="Copy Link"
              target={<Image src="/copy.svg" alt="copy" width={28} />}
              handleCopy={() =>
                navigator.clipboard.writeText(granteeRegistrationLink)
              }
            />
          </Stack>
          <div
            style={{
              height: 280,
              overflow: "auto",
              border: "1px solid #dee2e6",
            }}
          >
            <Table striped hover>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Name</th>
                  <th>Review</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {queryRes?.recipients.map((recipient: Recipient, i: number) => (
                  <tr key={i}>
                    <td className="w-33">{recipient.recipientAddress}</td>
                    <td className="w-33">{recipient.metadata.title}</td>
                    <td className="text-center ps-0">
                      {reviewingRecipients.find(
                        (reviewingRecipient) =>
                          recipient.id === reviewingRecipient.id,
                      )?.newStatus === NewStatus.ACCEPTED ? (
                        <Image
                          src="/success.svg"
                          alt="success"
                          width={24}
                          style={{
                            filter:
                              "invert(38%) sepia(93%) saturate(359%) hue-rotate(100deg) brightness(92%) contrast(94%)",
                          }}
                        />
                      ) : reviewingRecipients.find(
                          (reviewingRecipient) =>
                            recipient.id === reviewingRecipient.id,
                        )?.newStatus === NewStatus.REJECTED ||
                        cancelingRecipients.find(
                          (cancelingRecipient) =>
                            recipient.id === cancelingRecipient.id,
                        ) ? (
                        <Image
                          src="/close.svg"
                          alt="fail"
                          width={24}
                          style={{
                            filter:
                              "invert(29%) sepia(96%) saturate(1955%) hue-rotate(334deg) brightness(88%) contrast(95%)",
                          }}
                        />
                      ) : recipient.status === "APPROVED" ? (
                        <Image src="/success.svg" alt="success" width={24} />
                      ) : recipient.status === "REJECTED" ||
                        recipient.status === "CANCELED" ? (
                        <Image src="/close.svg" alt="fail" width={24} />
                      ) : null}
                    </td>
                    <td className="w-20">
                      {recipient.status === "PENDING" ? (
                        <Button
                          className="w-100 p-0"
                          onClick={() => {
                            setSelectedRecipient(recipient);
                          }}
                        >
                          Review
                        </Button>
                      ) : recipient.status === "APPROVED" ? (
                        <Button
                          variant="danger"
                          className="w-100 p-0"
                          onClick={() => {
                            setSelectedRecipient(recipient);
                          }}
                        >
                          Kick from Pool
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {selectedRecipient !== null && (
            <Stack
              direction="vertical"
              className="mt-4 border border-3 border-gray rounded-4 p-4"
            >
              <Form className="d-flex flex-column gap-4">
                <Row>
                  <Col>
                    <Form.Label>Recipient Address</Form.Label>
                    <Form.Control
                      value={selectedRecipient.recipientAddress}
                      disabled
                    />
                  </Col>
                  <Col>
                    <Form.Label>Name</Form.Label>
                    <Form.Control
                      value={selectedRecipient.metadata.title}
                      disabled
                    />
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Label>Website URL</Form.Label>
                    <Form.Control
                      value={selectedRecipient.metadata.website}
                      disabled
                    />
                  </Col>
                  <Col>
                    <Form.Label>Twitter</Form.Label>
                    <Form.Control
                      value={`@${selectedRecipient.metadata.projectTwitter}`}
                      disabled
                    />
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Label>Github User URL</Form.Label>
                    <Form.Control
                      value={
                        selectedRecipient.metadata.userGithub
                          ? `https://github.com/${selectedRecipient.metadata.userGithub}`
                          : ""
                      }
                      disabled
                    />
                  </Col>
                  <Col>
                    <Form.Label>Github Org URL</Form.Label>
                    <Form.Control
                      value={
                        selectedRecipient.metadata.projectGithub
                          ? `https://github.com/${selectedRecipient.metadata.projectGithub}`
                          : ""
                      }
                      disabled
                    />
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Label>Logo</Form.Label>
                    <Form.Control
                      value={`https://gateway.pinata.cloud/ipfs/${selectedRecipient.metadata.logoImg}`}
                      disabled
                    />
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <Form.Label>Description</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      disabled
                      style={{ resize: "none" }}
                      value={selectedRecipient.metadata.description}
                    />
                  </Col>
                </Row>
              </Form>
              <Stack direction="horizontal" gap={2} className="w-50 mt-4">
                {selectedRecipient.status === "APPROVED" ? (
                  <Button
                    variant="danger"
                    className="w-50"
                    onClick={handleCancelSelection}
                  >
                    Kick from Pool
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="success text-light"
                      className="w-50"
                      onClick={() => handleReviewSelection(NewStatus.ACCEPTED)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="danger"
                      className="w-50"
                      onClick={() => handleReviewSelection(NewStatus.REJECTED)}
                    >
                      Reject
                    </Button>{" "}
                  </>
                )}
              </Stack>
            </Stack>
          )}
          <Stack direction="horizontal" gap={1} className="mt-4">
            <Image src="/info.svg" alt="info" width={24} />
            <Card.Text className="m-0">
              A small{" "}
              {network?.tokens.find(
                (token) => allocationToken === token.address.toLowerCase(),
              )?.name ?? "allocation token"}{" "}
              deposit transaction is required before adding grantees to the pool
            </Card.Text>
          </Stack>
          <Button
            className="d-flex gap-2 align-items-center justify-content-center w-25 mt-2"
            disabled={transactions.length === 0}
            onClick={handleSubmit}
          >
            {areTransactionsLoading ? (
              <>
                <Spinner size="sm" />
                {completedTransactions + 1}/{transactions.length}
              </>
            ) : (
              `Submit ${transactions.length > 0 ? "(" + transactions.length + ")" : ""}`
            )}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
