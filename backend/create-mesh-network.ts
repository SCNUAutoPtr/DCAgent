import axios from 'axios';

const API_BASE = 'http://localhost:3000/api/v1';

// 交换机端口信息
const switch1Ports = [
  '2251d5b8-844c-4bfd-a613-e8edb3a391e5',
  '2c076051-09c0-4b75-ad88-c7af20cae7d9',
  '31871b11-e6e7-49d7-b00d-6b5c6a725537',
];

const switch2Ports = [
  '210229d4-dd67-406d-9bad-f6137086f04b',
  '2368e2af-ad1b-4b42-b578-591a2ce12bc0',
  '25f4a999-133b-4fff-89bd-ae07af3e166e',
];

const switch3Ports = [
  '0402b4e2-d7ef-48b8-81dd-514bcde0194c',
  '0903e9ad-b3b4-4cb4-95d5-7b4dfbacc65e',
  '146780b9-c900-4016-a51d-c4c7243da52e',
];

let nextShortId = 1000; // 从1000开始分配shortID

async function createCable(portAId: string, portBId: string, label: string) {
  const shortIdA = nextShortId++;
  const shortIdB = nextShortId++;

  try {
    const response = await axios.post(`${API_BASE}/cables/create`, {
      label,
      type: 'CAT6',
      length: 2,
      color: 'blue',
      portAId,
      portBId,
      shortIdA,
      shortIdB,
    });

    console.log(`✅ 创建线缆成功: ${label}`);
    console.log(`   端口A: ${portAId} (ShortID: ${shortIdA})`);
    console.log(`   端口B: ${portBId} (ShortID: ${shortIdB})`);
    console.log(`   线缆ID: ${response.data.id}\n`);

    return response.data;
  } catch (error: any) {
    console.error(`❌ 创建线缆失败: ${label}`);
    console.error(`   错误: ${error.response?.data?.error || error.message}\n`);
    throw error;
  }
}

async function createMeshNetwork() {
  console.log('开始创建网状网络连接...\n');
  console.log('='.repeat(60));

  try {
    // 连接1: 交换机1 <-> 交换机2
    await createCable(
      switch1Ports[0],
      switch2Ports[0],
      '交换机1-交换机2-链路1'
    );

    // 连接2: 交换机1 <-> 交换机3
    await createCable(
      switch1Ports[1],
      switch3Ports[0],
      '交换机1-交换机3-链路1'
    );

    // 连接3: 交换机2 <-> 交换机3
    await createCable(
      switch2Ports[1],
      switch3Ports[1],
      '交换机2-交换机3-链路1'
    );

    console.log('='.repeat(60));
    console.log('🎉 网状网络创建完成！');
    console.log('   已创建3条连接，形成完整的网状拓扑');
  } catch (error) {
    console.error('网络创建过程中出现错误，已停止');
  }
}

createMeshNetwork();
