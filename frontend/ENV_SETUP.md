# 环境变量配置说明

## 快速开始

### 本地开发（默认配置）
直接运行即可，使用默认的 `localhost:3000`：
```bash
npm run dev
```

### 局域网访问配置

1. **创建本地配置文件**：
   ```bash
   cp .env.local.example .env.local
   ```

2. **修改 `.env.local`**：
   ```
   # 将 localhost 改为你的实际 IP 地址
   VITE_API_BASE_URL=http://192.168.1.100:3000
   ```

3. **重启开发服务器**：
   ```bash
   npm run dev
   ```

4. **在局域网设备访问**：
   - 前端: `http://你的IP:5173`
   - 例如: `http://192.168.1.100:5173`

## 环境变量说明

### `VITE_API_BASE_URL`
后端 API 地址，用于代理配置。

- **开发环境默认**: `http://localhost:3000`
- **局域网访问**: `http://你的IP:3000`
- **生产环境**: 根据实际部署地址配置

## 配置文件优先级

1. `.env.local` - 本地配置（最高优先级，不提交到 Git）
2. `.env.development` - 开发环境配置
3. `.env.production` - 生产环境配置

## 查看本机 IP 地址

**macOS/Linux**:
```bash
ifconfig | grep "inet "
# 或
ip addr show
```

**Windows**:
```cmd
ipconfig
```

查找类似 `192.168.x.x` 的地址。

## 注意事项

1. `.env.local` 文件不会被提交到 Git
2. 修改环境变量后需要重启开发服务器
3. 确保后端服务器也配置为监听 `0.0.0.0`
4. 防火墙需要允许 5173 和 3000 端口访问
