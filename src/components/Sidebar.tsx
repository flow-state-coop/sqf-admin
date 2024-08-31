import { useEffect } from "react";
import { useRouter } from "next/router";
import Stack from "react-bootstrap/Stack";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQuery, gql } from "@apollo/client";
import { useAccount } from "wagmi";
import Dropdown from "react-bootstrap/Dropdown";
import Image from "react-bootstrap/Image";
import useAdminParams from "@/hooks/adminParams";
import { Program } from "@/types/program";
import { getApolloClient } from "@/lib/apollo";

const PROGRAMS_QUERY = gql`
  query ProgramsQuery($address: String, $chainId: Int) {
    profiles(
      filter: {
        chainId: { equalTo: $chainId }
        profileRolesByChainIdAndProfileId: {
          some: { address: { equalTo: $address } }
        }
        tags: { contains: "program" }
      }
    ) {
      id
      metadata
      profileRolesByChainIdAndProfileId {
        address
        role
      }
    }
  }
`;

const POOLS_QUERY = gql`
  query PoolsQuery($chainId: Int, $profileId: String, $address: String) {
    pools(
      filter: {
        chainId: { equalTo: $chainId }
        profileId: { equalTo: $profileId }
        poolRolesByChainIdAndPoolId: {
          some: { address: { equalTo: $address } }
        }
        tags: { contains: "allo" }
      }
    ) {
      id
      metadata
    }
  }
`;

function Sidebar() {
  const pathname = usePathname();
  const {
    profileId,
    poolId,
    chainId,
    updateProfileId,
    updateProfileOwner,
    updateProfileMembers,
    updatePoolId,
  } = useAdminParams();

  const router = useRouter();
  const { address, chain: connectedChain } = useAccount();
  const { data: programsQueryRes } = useQuery(PROGRAMS_QUERY, {
    client: getApolloClient("streamingfund"),
    variables: {
      address: address?.toLowerCase() ?? "",
      chainId: chainId,
    },
    skip: !address,
    pollInterval: 4000,
  });
  const { data: poolsQueryRes } = useQuery(POOLS_QUERY, {
    client: getApolloClient("streamingfund"),
    variables: {
      chainId,
      profileId,
      address: address?.toLowerCase() ?? "",
    },
    skip: !address || !profileId,
    pollInterval: 4000,
  });

  const selectedProfile = programsQueryRes?.profiles.find(
    (profile: Program) => profile.id === profileId,
  );
  const selectedPool = poolsQueryRes?.pools.find(
    (pool: { id: string }) => pool.id === poolId,
  );
  const isWrongNetwork = connectedChain?.id !== chainId;

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }

    const members = selectedProfile.profileRolesByChainIdAndProfileId.filter(
      (profileRole: { role: "MEMBER" | "OWNER" }) =>
        profileRole.role === "MEMBER",
    );

    updateProfileMembers(
      members.map((profileRole: { address: string }) => profileRole.address),
    );
    updateProfileOwner(
      selectedProfile.profileRolesByChainIdAndProfileId.find(
        (p: { role: "MEMBER" | "OWNER" }) => p.role === "OWNER",
      )?.address ?? null,
    );
  }, [selectedProfile, updateProfileOwner, updateProfileMembers]);

  if (pathname.startsWith("/admin") && !selectedProfile) {
    return null;
  }

  return (
    <Stack direction="vertical" gap={4} className="h-100 py-4 px-3 fs-5 shadow">
      {pathname.startsWith("/grantee") ? (
        <>
          <Link
            href={`/grantee/?chainid=${chainId}&poolid=${poolId}`}
            className={pathname === "/grantee" ? "fw-bold" : ""}
            style={{
              pointerEvents: !chainId || !poolId ? "none" : "auto",
            }}
          >
            Pool Application
          </Link>
          <Link
            href={`/grantee/tools/?chainid=${chainId}&poolid=${poolId}`}
            className={pathname === "/grantee/tools" ? "fw-bold" : ""}
            style={{
              pointerEvents: !chainId || !poolId ? "none" : "auto",
            }}
          >
            Grantee Tools
          </Link>
        </>
      ) : (
        <>
          <Stack
            direction="horizontal"
            gap={2}
            className="justify-content-between w-100"
            style={{ color: isWrongNetwork ? "#dee2e6" : "" }}
          >
            Program
            <Dropdown className="position-static w-75 overflow-hidden">
              <Dropdown.Toggle
                disabled={isWrongNetwork}
                variant="transparent"
                className="d-flex justify-content-between align-items-center w-100 border border-2 overflow-hidden"
              >
                <span
                  className="d-inline-block text-truncate"
                  style={{ color: isWrongNetwork ? "#dee2e6" : "" }}
                >
                  {selectedProfile.metadata.name}
                </span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {programsQueryRes?.profiles.map(
                  (profile: Program, i: number) => (
                    <Dropdown.Item
                      key={i}
                      onClick={() => {
                        updateProfileId(profile.id);
                        router.push(
                          `/admin/pools/?chainid=${chainId}&profileid=${profile.id}`,
                        );
                      }}
                    >
                      {profile?.metadata?.name ?? "N/A"}
                    </Dropdown.Item>
                  ),
                )}
              </Dropdown.Menu>
            </Dropdown>
          </Stack>
          <Stack
            direction="horizontal"
            gap={2}
            className="justify-content-between w-100"
            style={{ color: !selectedPool || isWrongNetwork ? "#dee2e6" : "" }}
          >
            Pool
            <Dropdown className="position-static w-75 overflow-hidden">
              <Dropdown.Toggle
                disabled={!selectedPool || isWrongNetwork}
                variant="transparent"
                className="d-flex justify-content-between align-items-center w-100 border border-2 overflow-hidden"
              >
                <span
                  className="d-inline-block text-truncate hidden"
                  style={{
                    color: !selectedPool || isWrongNetwork ? "#fff" : "",
                  }}
                >
                  {selectedPool?.metadata?.name ?? "N/A"}
                </span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {poolsQueryRes?.pools.map(
                  (
                    pool: { id: string; metadata: { name: string } },
                    i: number,
                  ) => (
                    <Dropdown.Item
                      key={i}
                      onClick={() => updatePoolId(pool.id)}
                    >
                      {pool?.metadata?.name ?? "N/A"}
                    </Dropdown.Item>
                  ),
                )}
              </Dropdown.Menu>
            </Dropdown>
          </Stack>
          <Stack
            direction="vertical"
            gap={3}
            className={`rounded-4 flex-grow-0 p-3 border ${selectedPool && !isWrongNetwork ? "border-black" : ""}`}
            style={{ color: !selectedPool || isWrongNetwork ? "#dee2e6" : "" }}
          >
            <Link
              href={`/admin/configure/?chainid=${chainId}&profileid=${profileId}&poolid=${poolId}`}
              className={`d-flex align-items-center gap-1 ${
                pathname.startsWith("/admin/configure") &&
                !!selectedPool &&
                !isWrongNetwork
                  ? "fw-bold"
                  : ""
              }`}
              style={{
                color: "inherit",
                pointerEvents:
                  !!profileId && !!selectedPool && !isWrongNetwork
                    ? "auto"
                    : "none",
              }}
            >
              <Image
                src={`${pathname.startsWith("/admin/configure") && !!selectedPool && !isWrongNetwork ? "/dot-filled.svg" : "/dot-unfilled.svg"}`}
                alt="Bullet Point"
                width={24}
                height={24}
                style={{
                  filter:
                    !selectedPool || isWrongNetwork
                      ? "invert(81%) sepia(66%) saturate(14%) hue-rotate(169deg) brightness(97%) contrast(97%)"
                      : "",
                }}
              />
              Configuration
            </Link>
            <Link
              href={`/admin/review/?chainid=${chainId}&profileid=${profileId}&poolid=${poolId}`}
              className={`d-flex align-items-center gap-1 ${
                pathname.startsWith("/admin/review") &&
                !!selectedPool &&
                !isWrongNetwork
                  ? "fw-bold"
                  : ""
              }`}
              style={{
                color: "inherit",
                pointerEvents:
                  selectedPool && !isWrongNetwork ? "auto" : "none",
              }}
            >
              <Image
                src={`${pathname.startsWith("/admin/review") && !!selectedPool && !isWrongNetwork ? "/dot-filled.svg" : "/dot-unfilled.svg"}`}
                alt="Bullet Point"
                width={24}
                height={24}
                style={{
                  filter:
                    !selectedPool || isWrongNetwork
                      ? "invert(81%) sepia(66%) saturate(14%) hue-rotate(169deg) brightness(97%) contrast(97%)"
                      : "",
                }}
              />
              Grantee Review
            </Link>
            <Link
              href={`/admin/matching/?chainid=${chainId}&profileid=${profileId}&poolid=${poolId}`}
              className={`d-flex align-items-center gap-1 ${
                pathname.startsWith("/admin/matching") &&
                !!selectedPool &&
                !isWrongNetwork
                  ? "fw-bold"
                  : ""
              }`}
              style={{
                color: "inherit",
                pointerEvents: selectedPool ? "auto" : "none",
              }}
            >
              <Image
                src={`${pathname.startsWith("/admin/matching") && !!selectedPool && !isWrongNetwork ? "/dot-filled.svg" : "/dot-unfilled.svg"}`}
                alt="Bullet Point"
                width={24}
                height={24}
                style={{
                  filter:
                    !selectedPool || isWrongNetwork
                      ? "invert(81%) sepia(66%) saturate(14%) hue-rotate(169deg) brightness(97%) contrast(97%)"
                      : "",
                }}
              />
              Matching Funds
            </Link>
            <Link
              href={`/?poolid=${poolId}&chainid=${chainId}`}
              style={{
                color: "inherit",
                pointerEvents:
                  poolId && chainId && !isWrongNetwork ? "auto" : "none",
              }}
              className="d-flex align-items-center gap-1"
            >
              <Image
                src="/dot-unfilled.svg"
                alt="Bullet Point"
                width={24}
                height={24}
                style={{
                  filter:
                    !selectedPool || isWrongNetwork
                      ? "invert(81%) sepia(66%) saturate(14%) hue-rotate(169deg) brightness(97%) contrast(97%)"
                      : "",
                }}
              />
              Pool UI
            </Link>
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default Sidebar;
