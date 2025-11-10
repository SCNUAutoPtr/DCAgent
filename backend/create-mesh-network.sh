#!/bin/bash

API_BASE="http://localhost:3000/api/v1"

# 交换机端口信息
SWITCH1_PORT1="2251d5b8-844c-4bfd-a613-e8edb3a391e5"
SWITCH1_PORT2="2c076051-09c0-4b75-ad88-c7af20cae7d9"
SWITCH1_PORT3="31871b11-e6e7-49d7-b00d-6b5c6a725537"

SWITCH2_PORT1="210229d4-dd67-406d-9bad-f6137086f04b"
SWITCH2_PORT2="2368e2af-ad1b-4b42-b578-591a2ce12bc0"
SWITCH2_PORT3="25f4a999-133b-4fff-89bd-ae07af3e166e"

SWITCH3_PORT1="0402b4e2-d7ef-48b8-81dd-514bcde0194c"
SWITCH3_PORT2="0903e9ad-b3b4-4cb4-95d5-7b4dfbacc65e"
SWITCH3_PORT3="146780b9-c900-4016-a51d-c4c7243da52e"

echo "开始创建网状网络连接..."
echo "============================================================"

# 连接1: 交换机1 <-> 交换机2
echo ""
echo "创建连接1: 交换机1 <-> 交换机2"
curl -X POST "${API_BASE}/cables/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"label\": \"交换机1-交换机2-链路1\",
    \"type\": \"CAT6\",
    \"length\": 2,
    \"color\": \"blue\",
    \"portAId\": \"${SWITCH1_PORT1}\",
    \"portBId\": \"${SWITCH2_PORT1}\",
    \"shortIdA\": 1000,
    \"shortIdB\": 1001
  }"
echo ""

# 连接2: 交换机1 <-> 交换机3
echo ""
echo "创建连接2: 交换机1 <-> 交换机3"
curl -X POST "${API_BASE}/cables/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"label\": \"交换机1-交换机3-链路1\",
    \"type\": \"CAT6\",
    \"length\": 2,
    \"color\": \"green\",
    \"portAId\": \"${SWITCH1_PORT2}\",
    \"portBId\": \"${SWITCH3_PORT1}\",
    \"shortIdA\": 1002,
    \"shortIdB\": 1003
  }"
echo ""

# 连接3: 交换机2 <-> 交换机3
echo ""
echo "创建连接3: 交换机2 <-> 交换机3"
curl -X POST "${API_BASE}/cables/create" \
  -H "Content-Type: application/json" \
  -d "{
    \"label\": \"交换机2-交换机3-链路1\",
    \"type\": \"CAT6\",
    \"length\": 2,
    \"color\": \"yellow\",
    \"portAId\": \"${SWITCH2_PORT2}\",
    \"portBId\": \"${SWITCH3_PORT2}\",
    \"shortIdA\": 1004,
    \"shortIdB\": 1005
  }"
echo ""

echo ""
echo "============================================================"
echo "🎉 网状网络创建完成！"
echo "   已创建3条连接，形成完整的网状拓扑"
