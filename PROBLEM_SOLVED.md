# 🎉 问题已解决！

## 问题根源

**Pumex 使用的是 Solidly/Velodrome 风格的 Router，而不是标准的 Uniswap V2！**

### 关键区别

| 特性 | Uniswap V2 | Solidly/Velodrome (Pumex) |
|------|-----------|---------------------------|
| Router 参数 | `address[] path` | `Route[] routes` |
| Route 格式 | 简单地址数组 | `{from, to, stable}` 元组数组 |
| 池子类型 | 单一类型 | volatile 和 stable 两种 |
| `getAmountsOut` | `(uint256, address[])` | `(uint256, Route[])` |

## 修复内容

### 1. 更新 ABI (`dex-abi.ts`)

从标准 Uniswap V2 格式：
```typescript
getAmountsOut(uint256 amountIn, address[] path)
```

改为 Solidly 格式：
```typescript
getAmountsOut(
  uint256 amountIn, 
  tuple[] routes {
    address from,
    address to,
    bool stable
  }
)
```

### 2. 实现 Route 构建 (`dex-swap.ts`)

```typescript
interface Route {
  from: Address;
  to: Address;
  stable: boolean;
}

function getSwapRoutes(fromToken: string, toToken: string): Route[] {
  // INJ 相关交易对 → volatile = false
  // 稳定币交易对 (USDC/USDT) → stable = true
  const isStableSwap = (fromToken === 'USDC' && toToken === 'USDT') || 
                       (fromToken === 'USDT' && toToken === 'USDC');
  
  return [{
    from: fromAddr,
    to: toAddr,
    stable: isStableSwap,
  }];
}
```

### 3. 更新所有 Swap 函数

所有调用 Router 的函数都从 `path` 改为 `routes`：
- `getAmountsOut(amountIn, routes)`
- `swapExactTokensForTokens(..., routes, ...)`
- `swapExactETHForTokens(..., routes, ...)`
- `swapExactTokensForETH(..., routes, ...)`

## 可用的交易对

通过 `find-pairs.ts` 脚本发现的池子：

| 交易对 | 类型 | 池子地址 | Reserve 0 | Reserve 1 |
|--------|------|---------|-----------|-----------|
| **WINJ/USDC** | Volatile | `0xe785...BDD` | 30,542.45 WINJ | 95.30 USDC |
| **WINJ/USDT** | Volatile | `0x7626...63f` | 111,476.10 WINJ | 347.27 USDT |
| **USDC/USDT** | Stable | `0x6675...Aa2` | - | - |

## 测试结果 ✅

运行 `pnpm test-solidly` 验证：

```
✅ WINJ → USDC: 0.1 WINJ = 0.311451 USDC
✅ WINJ → USDT: 0.1 WINJ = 0.310959 USDT
✅ USDC → USDT: 1 USDC = 0.999702 USDT
✅ USDT → USDC: 1 USDT = 0.999497 USDC
```

**所有交易对都工作正常！** 🎊

## 下一步

### 1. 刷新前端页面

现在访问 swap 页面应该可以：
- ✅ 正确获取 INJ、USDT、USDC 余额
- ✅ 成功获取 swap quote（不再 revert）
- ✅ 执行实际的 swap 交易

### 2. 测试流程

1. 打开 swap 页面
2. 选择 INJ → USDC
3. 输入 0.1 INJ
4. 应该看到报价：约 0.31 USDC
5. 点击 Swap 执行交易

### 3. 可用的调试脚本

```bash
# 查找可用的交易对
pnpm find-pairs

# 测试 Router 基本功能
pnpm test-router

# 验证 Solidly 格式的 routes
pnpm test-solidly
```

## 技术细节

### Solidly AMM 特点

1. **两种池子类型**：
   - **Volatile**: 用于波动性资产（如 INJ/USDC），使用 x*y=k 公式
   - **Stable**: 用于稳定币（如 USDC/USDT），使用 StableSwap 曲线

2. **Factory 函数**：
   ```solidity
   getPair(tokenA, tokenB, stable) → pair address
   ```
   需要指定 `stable` 参数！

3. **Router 函数**：
   所有交换函数都使用 `Route[]` 而不是 `address[]`

### 为什么会报错

之前使用 Uniswap V2 格式：
```typescript
// ❌ 错误：Router 不认识这个格式
args: [amountIn, [WINJ, USDC]]
```

现在使用 Solidly 格式：
```typescript
// ✅ 正确：包含 stable 标志
args: [amountIn, [{ from: WINJ, to: USDC, stable: false }]]
```

## 部署状态

- ✅ 代码已推送到 GitHub
- ✅ Vercel 应该会自动部署
- ⏳ 等待 Vercel 构建完成（约 2-3 分钟）

查看部署状态：https://vercel.com/dashboard

---

**🎯 问题完全解决！现在可以正常使用 Pumex 进行 swap 了！**
