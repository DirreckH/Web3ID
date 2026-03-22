import { getAddress, hexToBigInt, keccak256, stringToHex, type Address, type Hex, type PublicClient } from "viem";
import type { BehaviorBinding, BehaviorEvent } from "./types.js";
import { getBehaviorKindLabel, lookupRegistryAddress } from "./registry.js";

const TRANSFER_TOPIC = keccak256(stringToHex("Transfer(address,address,uint256)"));

function encodeEventId(parts: Array<string | number | bigint | undefined>) {
  return keccak256(stringToHex(parts.map((part) => String(part ?? "")).join(":")));
}

function directionFor(address: Address, from?: Address, to?: Address) {
  if (from && to && from.toLowerCase() === address.toLowerCase() && to.toLowerCase() === address.toLowerCase()) {
    return "self" as const;
  }
  if (from && from.toLowerCase() === address.toLowerCase()) {
    return "outgoing" as const;
  }
  if (to && to.toLowerCase() === address.toLowerCase()) {
    return "incoming" as const;
  }
  return "unknown" as const;
}

function createBehaviorEvent(input: {
  chainId: number;
  binding: BehaviorBinding;
  txHash: Hex;
  txIndex: number;
  blockNumber: bigint;
  blockTimestamp: string;
  kind: BehaviorEvent["kind"];
  label: string;
  value?: bigint;
  from?: Address;
  to?: Address;
  counterparty?: Address;
  logIndex?: number;
  protocolTags?: string[];
  evidenceRefs: string[];
  metadata?: Record<string, unknown>;
}): BehaviorEvent {
  if (!input.binding.address) {
    throw new Error(`Behavior ingestion requires an address-bound binding: ${input.binding.bindingId}`);
  }
  return {
    eventId: encodeEventId([input.txHash, input.binding.bindingId, input.kind, input.logIndex]),
    chainId: input.chainId,
    txHash: input.txHash,
    txIndex: input.txIndex,
    logIndex: input.logIndex,
    blockNumber: input.blockNumber,
    blockTimestamp: input.blockTimestamp,
    address: input.binding.address,
    direction: directionFor(input.binding.address, input.from, input.to),
    rootIdentityId: input.binding.rootIdentityId,
    subIdentityId: input.binding.subIdentityId,
    bindingId: input.binding.bindingId,
    kind: input.kind,
    label: input.label,
    protocolTags: input.protocolTags ?? [],
    counterparty: input.counterparty,
    contractAddress: input.to,
    value: input.value ?? 0n,
    rawRef: `chain:${input.chainId}:tx:${input.txHash}`,
    evidenceRefs: input.evidenceRefs,
    metadata: input.metadata,
  };
}

function dedupe(events: BehaviorEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.eventId)) {
      return false;
    }
    seen.add(event.eventId);
    return true;
  });
}

export async function collectBehaviorEvents(input: {
  publicClient: PublicClient;
  chainId: number;
  bindings: BehaviorBinding[];
  fromBlock: bigint;
  toBlock?: bigint;
}): Promise<BehaviorEvent[]> {
  const toBlock = input.toBlock ?? (await input.publicClient.getBlockNumber());
  const bindingMap = new Map(
    input.bindings
      .filter((binding) => Boolean(binding.address))
      .map((binding) => [binding.address!.toLowerCase(), binding]),
  );
  const events: BehaviorEvent[] = [];

  for (let blockNumber = input.fromBlock; blockNumber <= toBlock; blockNumber += 1n) {
    const block = await input.publicClient.getBlock({ blockNumber, includeTransactions: true });
    const blockTimestamp = new Date(Number(block.timestamp) * 1000).toISOString();

    for (const transaction of block.transactions) {
      const from = getAddress(transaction.from);
      const to = transaction.to ? getAddress(transaction.to) : undefined;
      const subjectBindings = [bindingMap.get(from.toLowerCase()), to ? bindingMap.get(to.toLowerCase()) : undefined].filter(
        (item): item is BehaviorBinding => Boolean(item),
      );
      if (!subjectBindings.length) {
        continue;
      }

      const receipt = await input.publicClient.getTransactionReceipt({ hash: transaction.hash });
      for (const binding of subjectBindings) {
        const counterparty = binding.address!.toLowerCase() === from.toLowerCase() ? to : from;
        const registryMatch = lookupRegistryAddress(counterparty);
        if (registryMatch) {
          events.push(
            createBehaviorEvent({
              chainId: input.chainId,
              binding,
              txHash: transaction.hash,
              txIndex: Number(transaction.transactionIndex),
              blockNumber,
              blockTimestamp,
              kind: registryMatch.behaviorKind,
              label: registryMatch.entry.label,
              value: transaction.value,
              from,
              to,
              counterparty,
              protocolTags: [registryMatch.entry.ruleFamily, registryMatch.entry.protocolType ?? registryMatch.catalog],
              evidenceRefs: [`tx:${transaction.hash}`, `counterparty:${counterparty}`],
            }),
          );
        } else if (transaction.input && transaction.input !== "0x") {
          events.push(
            createBehaviorEvent({
              chainId: input.chainId,
              binding,
              txHash: transaction.hash,
              txIndex: Number(transaction.transactionIndex),
              blockNumber,
              blockTimestamp,
              kind: "contract_call",
              label: getBehaviorKindLabel("contract_call"),
              value: transaction.value,
              from,
              to,
              counterparty,
              evidenceRefs: [`tx:${transaction.hash}`],
            }),
          );
        } else {
          events.push(
            createBehaviorEvent({
              chainId: input.chainId,
              binding,
              txHash: transaction.hash,
              txIndex: Number(transaction.transactionIndex),
              blockNumber,
              blockTimestamp,
              kind: "native_transfer",
              label: getBehaviorKindLabel("native_transfer"),
              value: transaction.value,
              from,
              to,
              counterparty,
              evidenceRefs: [`tx:${transaction.hash}`],
            }),
          );
        }
      }

      for (const log of receipt.logs) {
        if (!log.topics?.length || log.topics[0] !== TRANSFER_TOPIC || log.topics.length < 3) {
          continue;
        }
        const fromTopic = log.topics[1];
        const toTopic = log.topics[2];
        if (!fromTopic || !toTopic) {
          continue;
        }
        const logFrom = getAddress(`0x${fromTopic.slice(-40)}`);
        const logTo = getAddress(`0x${toTopic.slice(-40)}`);
        const relatedBindings = [bindingMap.get(logFrom.toLowerCase()), bindingMap.get(logTo.toLowerCase())].filter(
          (item): item is BehaviorBinding => Boolean(item),
        );
        for (const binding of relatedBindings) {
          const isNft = log.topics.length >= 4;
          events.push(
            createBehaviorEvent({
              chainId: input.chainId,
              binding,
              txHash: transaction.hash,
              txIndex: Number(transaction.transactionIndex),
              blockNumber,
              blockTimestamp,
              logIndex: Number(log.logIndex),
              kind: isNft ? "nft_transfer" : "erc20_transfer",
              label: getBehaviorKindLabel(isNft ? "nft_transfer" : "erc20_transfer"),
              value: isNft && log.topics[3] ? hexToBigInt(log.topics[3]) : log.data && log.data !== "0x" ? hexToBigInt(log.data) : 0n,
              from: logFrom,
              to: logTo,
              counterparty: binding.address!.toLowerCase() === logFrom.toLowerCase() ? logTo : logFrom,
              evidenceRefs: [`tx:${transaction.hash}`, `log:${log.logIndex}`],
            }),
          );
        }
      }
    }
  }

  return dedupe(events);
}
