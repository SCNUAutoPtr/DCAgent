/**
 * 测试全局 ShortID 系统
 *
 * 运行方式：npx tsx src/scripts/testGlobalShortId.ts
 */

import dataCenterService from '../services/dataCenterService';
import roomService from '../services/roomService';
import cabinetService from '../services/cabinetService';
import deviceService from '../services/deviceService';
import globalShortIdService from '../services/globalShortIdService';
import prisma from '../utils/prisma';

async function testGlobalShortId() {
  console.log('=== 测试全局 ShortID 系统 ===\n');

  try {
    // 1. 查看当前序列值
    const currentValue = await globalShortIdService.getCurrentSequenceValue();
    console.log(`当前全局 ShortID 序列值: ${currentValue}\n`);

    // 2. 创建一个数据中心
    console.log('创建数据中心...');
    const dataCenter = await dataCenterService.createDataCenter({
      name: '测试数据中心',
      location: '测试地址',
    });
    console.log(`✓ 数据中心已创建，shortId: ${dataCenter.shortId}`);

    // 3. 创建一个机房
    console.log('\n创建机房...');
    const room = await roomService.createRoom({
      name: '测试机房',
      floor: '1F',
      dataCenterId: dataCenter.id,
    });
    console.log(`✓ 机房已创建，shortId: ${room.shortId}`);

    // 4. 创建一个机柜
    console.log('\n创建机柜...');
    const cabinet = await cabinetService.createCabinet({
      name: '测试机柜',
      position: 'A1',
      height: 42,
      roomId: room.id,
    });
    console.log(`✓ 机柜已创建，shortId: ${cabinet.shortId}`);

    // 5. 创建一个设备
    console.log('\n创建设备...');
    const device = await deviceService.createDevice({
      name: '测试设备',
      type: 'SWITCH',
      model: 'Test-Model-X',
      serialNo: 'SN-TEST-001',
      uPosition: 1,
      uHeight: 2,
      cabinetId: cabinet.id,
    });
    console.log(`✓ 设备已创建，shortId: ${device.shortId}`);

    // 6. 检查所有 shortId 是否唯一
    console.log('\n验证 ShortID 唯一性...');
    const shortIds = [
      dataCenter.shortId,
      room.shortId,
      cabinet.shortId,
      device.shortId,
    ];
    const uniqueShortIds = new Set(shortIds);

    if (uniqueShortIds.size === shortIds.length) {
      console.log('✓ 所有 ShortID 均唯一');
      console.log(`  ShortIDs: ${shortIds.join(', ')}`);
    } else {
      console.error('✗ 发现 ShortID 重复！');
      console.error(`  ShortIDs: ${shortIds.join(', ')}`);
    }

    // 7. 验证全局分配表
    console.log('\n验证全局分配表...');
    for (const shortId of shortIds) {
      const allocation = await globalShortIdService.getEntityByShortId(shortId);
      if (allocation) {
        console.log(`✓ ShortID ${shortId} -> ${allocation.entityType} (${allocation.entityId})`);
      } else {
        console.error(`✗ ShortID ${shortId} 未在分配表中找到`);
      }
    }

    // 8. 查看更新后的序列值
    const newValue = await globalShortIdService.getCurrentSequenceValue();
    console.log(`\n更新后的全局 ShortID 序列值: ${newValue}`);
    console.log(`本次测试分配了 ${shortIds.length} 个 ShortID (${currentValue} -> ${newValue})`);

    // 9. 清理测试数据
    console.log('\n清理测试数据...');
    await deviceService.deleteDevice(device.id);
    console.log(`✓ 已删除设备，释放 ShortID ${device.shortId}`);

    await cabinetService.deleteCabinet(cabinet.id);
    console.log(`✓ 已删除机柜，释放 ShortID ${cabinet.shortId}`);

    await roomService.deleteRoom(room.id);
    console.log(`✓ 已删除机房，释放 ShortID ${room.shortId}`);

    await dataCenterService.deleteDataCenter(dataCenter.id);
    console.log(`✓ 已删除数据中心，释放 ShortID ${dataCenter.shortId}`);

    // 10. 验证 ShortID 已释放
    console.log('\n验证 ShortID 已释放...');
    for (const shortId of shortIds) {
      const allocation = await globalShortIdService.getEntityByShortId(shortId);
      if (allocation) {
        console.error(`✗ ShortID ${shortId} 应该已释放但仍在分配表中`);
      } else {
        console.log(`✓ ShortID ${shortId} 已成功释放`);
      }
    }

    console.log('\n✅ 全局 ShortID 系统测试通过！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testGlobalShortId();
