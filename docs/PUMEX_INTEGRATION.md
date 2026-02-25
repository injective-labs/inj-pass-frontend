# Pumex DEX 集成配置指南

本项目已集成基于 Uniswap V2 标准的 DEX swap 功能，支持以下交易对：
- INJ ⇔ USDT
- INJ ⇔ USDC  
- USDT ⇔ USDC

## ⚠️ 重要：需要配置 Router 地址

在使用 swap 功能之前，你需要配置 Pumex Router 合约地址。

### 查找 Pumex Router 地址的方法

#### 方法 1: 通过 Pumex dApp 查找（推荐）

1. **访问 Pumex 官方应用**
   - 打开 Pumex 的 Web 应用（如果有 app.pumex.io 或类似地址）
   
2. **打开浏览器开发者工具**
   - 按 `F12` 或右键 → "检查"
   - 切换到 `Network` (网络) 标签
   
3. **执行一次测试 Swap**
   - 选择任意交易对
   - 输入金额
   - 点击 Swap（可以在确认前取消）
   
4. **查看交易请求**
   - 在 Network 标签中查找 `eth_sendTransaction` 或类似的请求
   - 查看请求的 `to` 地址，这就是 Router 合约地址
   - 复制这个地址

5. **验证地址**
   - 访问 https://blockscout.injective.network/
   - 搜索你找到的地址
   - 确认它是一个合约（Contract），而不是普通地址

#### 方法 2: 通过区块浏览器搜索

1. 访问 https://blockscout.injective.network/
2. 在搜索框中输入 "Pumex" 或 "Router"
3. 查找已验证的 Router 合约
4. 确认合约名称包含 "Router" 或 "SwapRouter"

#### 方法 3: 查看 Pumex 文档或社区

- 查看 Pumex 的 GitBook 文档: https://pumex.gitbook.io/pumex-docs
- 加入 Pumex 的 Telegram/Discord 频道询问
- 查看 Pumex 的 GitHub 仓库（如果有）

### 配置 Router 地址

找到 Router 地址后，打开以下文件进行配置：

**文件位置**: `frontend/src/services/dex-swap.ts`

找到第 30 行左右的这段代码：

```typescript
// ⚠️ CONFIGURE THIS: Replace with actual Pumex Router address
export const ROUTER_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
```

将 `0x0000000000000000000000000000000000000000` 替换为你找到的 Pumex Router 地址。

例如：
```typescript
export const ROUTER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Address;
```

### Token 地址已配置

以下 token 地址已经配置好（基于 Injective 官方文档）：

**Mainnet (Chain ID: 1776)**
- INJ (Native): `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
- WINJ (Wrapped INJ): `0x0000000088827d2d103ee2d9A6b781773AE03FfB`
- USDT: `0x88f7F2b685F9692caf8c478f5BADF09eE9B1Cc13`
- USDC: `0x2a25fbD67b3aE485e461fe55d9DbeF302B7D3989`

这些地址来自 Injective 官方文档，无需修改。

## 如何测试

### 1. 配置完成后

1. 启动开发服务器：
   ```bash
   cd frontend
   pnpm dev
   ```

2. 访问 http://localhost:3000/swap

3. 解锁你的钱包（使用 Passkey）

4. 尝试执行一次 swap

### 2. 测试步骤

**测试 INJ → USDT**
1. 在 "From" 选择 INJ
2. 在 "To" 选择 USDT
3. 输入少量 INJ（如 0.01）
4. 等待报价加载
5. 检查预估输出是否合理
6. 点击 "Swap Tokens"
7. 查看交易结果

**测试 USDT → USDC**
1. 确保你有 USDT 余额
2. 选择 USDT → USDC
3. 输入金额
4. 执行 swap

## 常见问题

### Q: 报价加载失败

**可能原因**:
- Router 地址未配置或错误
- 该交易对没有流动性池
- RPC 连接问题

**解决方法**:
1. 检查浏览器控制台的错误信息
2. 确认 Router 地址正确
3. 在 Pumex dApp 上确认该交易对是否可用

### Q: Swap 执行失败

**可能原因**:
- 余额不足
- 滑点设置过低
- Gas 不足
- Token 未授权

**解决方法**:
1. 检查错误信息
2. 如果是授权问题，代码会自动处理
3. 尝试增加滑点（如从 0.5% 改为 1%）
4. 确保有足够的 INJ 支付 gas

### Q: 如何查看交易记录？

成功 swap 后，会显示交易哈希。你可以：
1. 复制交易哈希
2. 访问 https://blockscout.injective.network/
3. 粘贴哈希查看详情

## 高级配置

### 切换到 Testnet

如果需要在 Testnet 上测试：

1. 修改 `frontend/src/types/chain.ts`:
   ```typescript
   export const DEFAULT_CHAIN = INJECTIVE_TESTNET;
   ```

2. 修改 `frontend/src/services/tokens.ts`:
   ```typescript
   export const TOKENS = TOKENS_TESTNET;
   ```

3. 修改 `frontend/src/services/dex-swap.ts`:
   ```typescript
   import { INJECTIVE_TESTNET } from '@/types/chain';
   // ... 使用 INJECTIVE_TESTNET
   ```

### 调整滑点

默认滑点是 0.5%，用户可以在 UI 中修改。如果需要修改默认值：

在 `frontend/app/swap/page.tsx` 中：
```typescript
const [slippage, setSlippage] = useState('0.5'); // 改为其他值，如 '1.0'
```

## 技术架构

### 文件结构

```
frontend/src/
├── services/
│   ├── dex-swap.ts       # 核心 swap 逻辑
│   ├── dex-abi.ts        # Router 和 ERC20 ABI
│   └── tokens.ts         # Token 配置和地址
├── utils/
│   └── wallet.ts         # 钱包工具函数
└── app/swap/
    └── page.tsx          # Swap UI 页面
```

### 主要功能

1. **getSwapQuote()** - 获取 swap 报价
2. **executeSwap()** - 执行 swap 交易
3. **getTokenBalances()** - 查询 token 余额
4. **approveToken()** - 授权 token（自动处理）

### Swap 流程

1. 用户输入金额
2. 自动获取报价（500ms 防抖）
3. 显示预估输出和价格影响
4. 用户点击 Swap
5. 检查并处理 token 授权（如果需要）
6. 执行 swap 交易
7. 等待确认
8. 刷新余额

## 需要帮助？

如果遇到问题：

1. 检查浏览器控制台的错误信息
2. 确认 Router 地址已正确配置
3. 确认在 Injective EVM Mainnet (Chain ID: 1776)
4. 确保钱包已解锁且有足够余额

## 下一步优化

- [ ] 添加多跳路由（通过中间 token）
- [ ] 集成价格 oracle 进行价格影响计算
- [ ] 添加历史交易记录
- [ ] 支持更多 token
- [ ] 优化 gas 估算
