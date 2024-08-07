import Stack from "react-bootstrap/Stack";
import { usePathname } from "next/navigation";
import Link from "next/link";
import useAdminParams from "@/hooks/adminParams";

function Sidebar() {
  const pathname = usePathname();
  const { profileId, poolId, chainId } = useAdminParams();

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
          <Link
            href="/admin"
            className={pathname === "/admin" ? "fw-bold" : ""}
          >
            Program Selection
          </Link>
          <Link
            href="/admin/pools"
            className={pathname.startsWith("/admin/pools") ? "fw-bold" : ""}
            style={{
              color: profileId ? "" : "gray",
              pointerEvents: profileId ? "auto" : "none",
            }}
          >
            Pool Selection
          </Link>
          <Link
            href="/admin/configure"
            className={pathname.startsWith("/admin/configure") ? "fw-bold" : ""}
            style={{
              color: profileId ? "" : "gray",
              pointerEvents: profileId ? "auto" : "none",
            }}
          >
            Configuration
          </Link>
          <Link
            href="/admin/review"
            className={pathname.startsWith("/admin/review") ? "fw-bold" : ""}
            style={{
              color: poolId ? "" : "gray",
              pointerEvents: poolId ? "auto" : "none",
            }}
          >
            Grantee Review
          </Link>
          <Link
            href="/admin/matching"
            className={pathname.startsWith("/admin/matching") ? "fw-bold" : ""}
            style={{
              color: poolId ? "" : "gray",
              pointerEvents: poolId ? "auto" : "none",
            }}
          >
            Matching Funds
          </Link>
          <Link
            href={`/?poolid=${poolId}&chainid=${chainId}`}
            style={{
              color: poolId && chainId ? "" : "gray",
              pointerEvents: poolId && chainId ? "auto" : "none",
            }}
          >
            Pool UI
          </Link>
        </>
      )}
    </Stack>
  );
}

export default Sidebar;
