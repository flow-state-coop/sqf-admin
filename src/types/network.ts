import { Address } from "viem";
import { Token } from "@/types/token";

export type Network = {
  id: number;
  name: string;
  icon: string;
  rpcUrl: string;
  blockExplorer: string;
  superfluidExplorer: string;
  superfluidDashboard: string;
  superfluidSubgraph: string;
  onRampLabel: string;
  flowStateCoreGda: string;
  passportDecoder: Address;
  superfluidHost: Address;
  superfluidResolver: Address;
  recipientSuperappFactory: Address;
  tokens: Token[];
  allo: Address;
  alloRegistry: Address;
  gdaForwarder: Address;
};
