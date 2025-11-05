import neo4jConnection from './src/graph/neo4j';

async function checkPortProperties() {
  const session = neo4jConnection.getSession();

  try {
    const result = await session.run(
      `MATCH (port:Port)
       RETURN port
       LIMIT 5`
    );

    console.log('Port 节点的属性：\n');
    result.records.forEach((record: any, idx) => {
      const port = record.get('port');
      console.log(`端口 ${idx + 1}:`);
      console.log('  Properties:', port.properties);
      console.log('');
    });

  } finally {
    await session.close();
  }
}

checkPortProperties().catch(console.error);
