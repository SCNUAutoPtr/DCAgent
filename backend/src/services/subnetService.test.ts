import assert from 'node:assert/strict';
import test from 'node:test';
import { IpStatus } from '@prisma/client';
import { calculateSubnetStats, getSubnetCapacity } from './subnetService';

test('容量按 CIDR 算，去掉网络地址和广播地址', () => {
  assert.equal(getSubnetCapacity(24), 254);
  assert.equal(getSubnetCapacity(26), 62);
  assert.equal(getSubnetCapacity(30), 2);
});

test('/31 是点对点链路，两个地址都可用；/32 只有一个', () => {
  assert.equal(getSubnetCapacity(31), 2);
  assert.equal(getSubnetCapacity(32), 1);
});

test('只建了一条 IP 记录的 /24，总数仍然是 254', () => {
  const stats = calculateSubnetStats(
    [{ address: '192.168.254.1', status: IpStatus.ALLOCATED }],
    { network: '192.168.254.0', cidr: 24 }
  );

  assert.equal(stats.total, 254);
  assert.equal(stats.allocated, 1);
  // 没建记录的地址算空闲
  assert.equal(stats.free, 253);
  assert.equal(stats.utilizationRate, '0.39');
});

test('空网段的地址全部算空闲', () => {
  const stats = calculateSubnetStats([], { network: '192.168.9.0', cidr: 24 });

  assert.equal(stats.total, 254);
  assert.equal(stats.free, 254);
  assert.equal(stats.utilizationRate, '0.00');
});

test('自动生成的地址池里，网络地址和广播地址不计入统计', () => {
  const ipAddresses = [
    { address: '10.0.0.0', status: IpStatus.RESERVED }, // 网络地址
    { address: '10.0.0.255', status: IpStatus.RESERVED }, // 广播地址
    { address: '10.0.0.1', status: IpStatus.RESERVED }, // 网关
    { address: '10.0.0.2', status: IpStatus.ALLOCATED },
    ...Array.from({ length: 252 }, (_, i) => ({
      address: `10.0.0.${i + 3}`,
      status: IpStatus.FREE,
    })),
  ];

  const stats = calculateSubnetStats(ipAddresses, { network: '10.0.0.0', cidr: 24 });

  assert.equal(stats.total, 254);
  assert.equal(stats.reserved, 1); // 只剩网关
  assert.equal(stats.allocated, 1);
  assert.equal(stats.free, 252); // 与池中 FREE 条目数一致
  assert.equal(stats.usable, 253);
});

test('禁用的地址不算在可用容量里', () => {
  const stats = calculateSubnetStats(
    [
      { address: '172.16.0.1', status: IpStatus.ALLOCATED },
      { address: '172.16.0.2', status: IpStatus.BLOCKED },
    ],
    { network: '172.16.0.0', cidr: 24 }
  );

  assert.equal(stats.blocked, 1);
  assert.equal(stats.usable, 253);
  assert.equal(stats.free, 252);
});
