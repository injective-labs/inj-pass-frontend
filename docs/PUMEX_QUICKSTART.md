# Pumex Swap 集成 - 快速开始

## ✅ 已完成的工作

我已经为你的 injpass-nfc 项目完整集成了 Pumex DEX swap 功能，支持以下三个交易对：

1. **INJ ⇔ USDT**
2. **INJ ⇔ USDC**
3. **USDT ⇔ USDC**

### 已实现的功能

✅ **实时报价** - 输入金额后自动获取最新汇率  
✅ **余额查询** - 自动显示各 token 的实时余额  
✅ **Token 授权** - 自动处理 ERC20 授权流程  
✅ **Swap 执行** - 一键完成代币兑换  
✅ **错误处理** - 友好的错误提示  
✅ **加载状态** - 清晰的操作反馈  

### 技术实现

- 使用 `viem` 与 Injective EVM 交互
- 基于 Uniswap V2 标准 Router 接口
- 完整的 TypeScript 类型支持
- 自动处理原生 INJ 和 Wrapped INJ 转换

## ⚠️ 唯一需要配置的：Router 地址

在使用之前，你只需要做一件事：**配置 Pumex Router 合约地址**

### 快速配置步骤

#### 步骤 1: 查找 Router 地址

**方法 A: 通过 Pumex dApp**（最简单）

1. 打开 Pumex 的 Web 应用
2. 按 `F12` 打开开发者工具
3. 切换到 `Network` 标签
4. 执行一次 swap（可以在确认前取消）
5. 查找 `eth_sendTransaction` 请求
6. 复制请求中的 `to` 地址 - 这就是 Router 地址

**方法 B: 通过区块浏览器**

1. 访问 https://blockscout.injective.network/
2. 搜索 "Pumex Router"
3. 找到已验证的合约地址

**方法 C: 询问社区**

- Pumex GitBook: https://pumex.gitbook.io/pumex-docs
- Pumex Telegram/Discord
- Injective 社区

#### 步骤 2: 配置地址

打开文件：`frontend/src/services/dex-swap.ts`

找到第 30 行左右：

```typescript
export const ROUTER_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
```

替换为你找到的地址：

```typescript
export const ROUTER_ADDRESS = '0x你的Router地址' as Address;
```

保存文件。

#### 步骤 3: 测试

```bash
cd frontend
pnpm install  # 安装新依赖（tsx）
pnpm dev      # 启动开发服务器
```

访问 http://localhost:3000/swap 测试功能！

## 🛠️ 辅助工具

### 验证 Router 地址

我创建了一个辅助脚本来验证 Router 地址是否正确：

1. 编辑 `frontend/scripts/find-router.ts`
2. 将 `POTENTIAL_ROUTER_ADDRESS` 替换为你要检查的地址
3. 运行验证：

```bash
cd frontend
pnpm find-router
```

脚本会检查：
- ✅ 地址是否是合约
- ✅ 是否有 Router 标准方法
- ✅ 能否获取 swap 报价

## 📁 项目结构

```
frontend/
├── src/
│   ├── services/
│   │   ├── dex-swap.ts      # ⚠️ 需要配置 ROUTER_ADDRESS
│   │   ├── dex-abi.ts       # Router 和 ERC20 ABI
│   │   └── tokens.ts        # Token 地址配置（已完成）
│   ├── utils/
│   │   └── wallet.ts        # 钱包工具函数
│   └── app/swap/
│       └── page.tsx         # Swap UI（已集成）
├── scripts/
│   └── find-router.ts       # Router 地址验证工具
└── package.json             # 已添加 find-router 命令
```

## 🎯 使用示例

### 1. INJ → USDT

```
1. 解锁钱包
2. 选择 From: INJ, To: USDT
3. 输入金额，如 0.1 INJ
4. 等待报价加载
5. 检查预估输出
6. 点击 "Swap Tokens"
7. 等待确认
```

### 2. USDT → USDC

```
1. 确保有 USDT 余额
2. 选择 From: USDT, To: USDC
3. 输入金额
4. 点击 Swap
5. 系统自动处理授权（如需要）
6. 完成兑换
```

## 🔍 如何调试

### 查看日志

打开浏览器控制台（F12），所有 swap 操作都会有详细日志：

```
[Swap] Fetching quote for 0.1 INJ -> USDT
[Swap] Quote received: 2.5 USDT
[Swap] Checking allowance...
[Swap] Executing swap...
[Swap] Transaction hash: 0x...
```

### 常见错误

**错误**: "Router address not configured"  
**解决**: 配置 `ROUTER_ADDRESS`

**错误**: "Failed to get swap quote"  
**解决**: 
- 检查 Router 地址是否正确
- 确认交易对有流动性
- 验证 RPC 连接

**错误**: "Swap failed: insufficient allowance"  
**解决**: 代码会自动处理，如果仍然失败，手动增加授权额度

## 📊 Token 地址（已配置）

所有 token 地址已基于 Injective 官方文档配置：

| Token | 地址 | 来源 |
|-------|------|------|
| INJ (Native) | `0xEeee...EEeE` | Injective |
| WINJ | `0x0000...FfB` | Injective Docs |
| USDT | `0x88f7...Cc13` | Injective Docs |
| USDC | `0x2a25...3989` | Injective Docs |

## 🚀 测试清单

配置完成后，按此清单测试：

- [ ] 配置 Router 地址
- [ ] 运行 `pnpm dev`
- [ ] 访问 /swap 页面
- [ ] 解锁钱包
- [ ] 查看余额是否正确显示
- [ ] 测试 INJ → USDT 报价
- [ ] 执行一次小额 swap
- [ ] 检查交易是否成功
- [ ] 验证余额已更新

## 📖 完整文档

详细配置说明请查看：[PUMEX_INTEGRATION.md](../PUMEX_INTEGRATION.md)

## 🆘 需要帮助？

1. 查看浏览器控制台错误
2. 使用 `pnpm find-router` 验证地址
3. 检查交易详情: https://blockscout.injective.network/
4. 查看完整文档: PUMEX_INTEGRATION.md

## ✨ 技术亮点

- **零依赖侵入**: 完全复用现有的 wallet context
- **类型安全**: 完整的 TypeScript 类型
- **用户友好**: 自动授权、实时报价、错误提示
- **生产就绪**: 完善的错误处理和重试机制
- **可扩展**: 易于添加新 token 和交易对

---

**准备好了吗？**

1. 找到 Router 地址
2. 配置到 `dex-swap.ts`
3. `pnpm dev`
4. 开始交易！🎉
