import { SNMPService } from './services/snmpService';
import { getTemplateByModel, detectDeviceModel } from './config/deviceTemplates';

const IP = process.argv[2] || '116.57.62.8';
const COMMUNITY = process.argv[3] || 'rwcommstr';

async function testTemplate() {
  console.log(`\n测试 WR5220G3 模板 - ${IP} (community: ${COMMUNITY})\n`);

  const client = new SNMPService({ host: IP, community: COMMUNITY });

  try {
    // 1. 获取设备信息并检测机型
    console.log('🔍 步骤 1: 检测设备机型...');

    // 尝试获取系统型号，如果失败则手动指定
    let detectedModel = 'WR5220G3'; // 默认机型
    try {
      const lenovoInfo = await client.getLenovoBMCInfo();
      console.log(`   系统型号: ${lenovoInfo.systemModel}`);
      console.log(`   序列号: ${lenovoInfo.serialNumber}`);
      console.log(`   BMC 版本: ${lenovoInfo.bmcVersion}`);

      detectedModel = await detectDeviceModel(lenovoInfo.systemModel || '') || 'WR5220G3';
    } catch (error: any) {
      console.log(`   ⚠️  无法获取 BMC 信息，使用默认机型: ${detectedModel}`);
      console.log(`   (某些 OID 在此设备上不可用)`);
    }

    console.log(`   检测到的机型: ${detectedModel}`);

    if (!detectedModel) {
      console.log('❌ 无法检测到机型，请检查 systemModel');
      return;
    }

    // 2. 加载模板
    console.log('\n📋 步骤 2: 加载设备模板...');
    const template = getTemplateByModel(detectedModel);
    if (!template) {
      console.log(`❌ 未找到 ${detectedModel} 的模板配置`);
      return;
    }

    console.log(`   ✅ 加载模板: ${template.description}`);
    console.log(`   厂商: ${template.vendor}`);
    console.log(`   配置的传感器类型:`);
    console.log(`     - 温度: ${template.oids.temperature.length} 个 OID`);
    console.log(`     - 风扇: ${template.oids.fan.length} 个 OID`);
    console.log(`     - 功率: ${template.oids.power.length} 个 OID`);
    console.log(`     - 电压: ${template.oids.voltage.length} 个 OID`);

    // 3. 测试实际数据获取
    console.log('\n🌡️  步骤 3: 测试温度传感器...');
    const tempSensors = await client.getLenovoTemperatureSensors();
    console.log(`   实际获取到 ${tempSensors.length} 个温度传感器`);

    // 显示前5个
    console.log('   前 5 个温度传感器:');
    tempSensors.slice(0, 5).forEach((sensor, i) => {
      console.log(`     ${i + 1}. ${sensor.name}: ${sensor.value}`);
    });

    // 4. 测试风扇数据
    console.log('\n💨 步骤 4: 测试风扇传感器...');
    const fanSensors = await client.getLenovoFans();
    console.log(`   实际获取到 ${fanSensors.length} 个风扇传感器`);

    console.log('   前 5 个风扇传感器:');
    fanSensors.slice(0, 5).forEach((sensor, i) => {
      console.log(`     ${i + 1}. ${sensor.name}: ${sensor.value}`);
    });

    // 5. 测试功率数据（使用模板中定义的 OID）
    console.log('\n⚡ 步骤 5: 测试功率传感器（使用模板 OID）...');
    try {
      const powerOids = [
        '1.3.6.1.4.1.53184.1.3.1.14', // Total Power
        '1.3.6.1.4.1.53184.1.3.1.15', // CPU Power
        '1.3.6.1.4.1.53184.1.3.1.16', // Memory Power
        '1.3.6.1.4.1.53184.1.3.1.19', // 24h Avg Power
      ];

      const powerResults = await client.get(powerOids);
      console.log('   功率数据:');
      console.log(`     总功耗: ${powerResults[0]?.value || 'N/A'} W`);
      console.log(`     CPU 功耗: ${powerResults[1]?.value || 'N/A'} W`);
      console.log(`     内存功耗: ${powerResults[2]?.value || 'N/A'} W`);
      console.log(`     24h 平均: ${powerResults[3]?.value || 'N/A'} W`);
    } catch (error: any) {
      console.log(`   ⚠️  功率数据获取失败: ${error.message}`);
    }

    // 6. 测试传感器映射
    console.log('\n🗺️  步骤 6: 测试传感器名称映射...');
    if (template.sensorMapping) {
      const mappingCount = Object.keys(template.sensorMapping).length;
      console.log(`   模板中定义了 ${mappingCount} 个传感器映射`);

      // 检查几个关键传感器
      const keySensors = ['CPU0_Temp', 'Sys_Inlet_Temp', 'Total_Power'];
      console.log('   关键传感器配置:');
      keySensors.forEach(sensorName => {
        const mapping = template.sensorMapping?.[sensorName];
        if (mapping) {
          console.log(`     ✅ ${sensorName}:`);
          console.log(`        显示名称: ${mapping.displayName}`);
          console.log(`        单位: ${mapping.unit}`);
          if (mapping.thresholds) {
            console.log(`        告警阈值: 警告=${mapping.thresholds.warning}, 严重=${mapping.thresholds.critical}`);
          }
        } else {
          console.log(`     ⚠️  ${sensorName}: 未配置映射`);
        }
      });
    }

    console.log('\n✅ 模板测试完成！');
    console.log('\n总结:');
    console.log(`  - 机型检测: ${detectedModel}`);
    console.log(`  - 模板加载: 成功`);
    console.log(`  - 温度传感器: ${tempSensors.length} 个`);
    console.log(`  - 风扇传感器: ${fanSensors.length} 个`);
    console.log(`  - 传感器映射: ${Object.keys(template.sensorMapping || {}).length} 个`);

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testTemplate().catch(console.error);
