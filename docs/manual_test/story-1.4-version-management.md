# Story 1.4: Version Management - 手工验收文档

## 概述

本文档提供Story 1.4版本管理功能的完整手工验收步骤。该功能增加了`--version`和`--check`标志，用于显示版本信息和系统检查。

## 验收前准备

1. 确保您有`claude-auto-resume.sh`脚本的最新版本（包含Story 1.4的修改）
2. 确保脚本有执行权限：`chmod +x claude-auto-resume.sh`
3. 准备测试环境（确保有Claude CLI或准备测试没有Claude CLI的场景）

## 验收场景

### AC1: 支持--version标志显示当前脚本版本

#### 场景1.1: 长格式版本标志
```bash
./claude-auto-resume.sh --version

# 期望输出：
# claude-auto-resume v1.2.0

# 验证点：
# ✓ 输出格式为 "claude-auto-resume v{版本号}"
# ✓ 版本号遵循语义化版本规范 (major.minor.patch)
# ✓ 命令执行后立即退出，不继续执行其他逻辑
# ✓ 退出代码为 0
```

#### 场景1.2: 短格式版本标志
```bash
./claude-auto-resume.sh -v

# 期望输出：
# claude-auto-resume v1.2.0

# 验证点：
# ✓ 短格式标志 -v 与长格式 --version 输出相同
# ✓ 命令执行后立即退出
# ✓ 退出代码为 0
```

#### 场景1.3: 版本标志优先级测试
```bash
# 测试版本标志与其他参数混合使用
./claude-auto-resume.sh --version "some prompt"
./claude-auto-resume.sh -p "test" --version
./claude-auto-resume.sh -c --version

# 期望输出：（所有情况都应该）
# claude-auto-resume v1.2.0

# 验证点：
# ✓ 无论其他参数如何，--version 都应该优先执行
# ✓ 不会尝试处理其他参数或执行主要逻辑
```

### AC2: 支持--check标志进行环境验证和显示系统信息

#### 场景2.1: 基本检查功能（Claude CLI可用）
```bash
./claude-auto-resume.sh --check

# 期望输出示例：
# claude-auto-resume v1.2.0 - System Check
# ================================================
# 
# Script Information:
#   Version: 1.2.0
#   Location: /path/to/claude-auto-resume.sh
# 
# Claude CLI Information:
#   Status: Available
#   Location: /path/to/claude
#   Version: 1.0.45 (Claude Code)
#   --dangerously-skip-permissions: Supported
# 
# System Compatibility:
#   OS: Darwin (或 Linux)
#   Architecture: arm64 (或 x86_64)
#   Shell: /bin/zsh (或用户的shell)
# 
# Network Utilities:
#   ping: Available
#   curl: Available
#   wget: Available
# 
# Environment Validation:
#   Claude CLI: ✓ Available
#   Network connectivity: ✓ Connected

# 验证点：
# ✓ 显示完整的系统检查报告
# ✓ 包含脚本版本信息
# ✓ 显示Claude CLI的详细信息
# ✓ 包含系统兼容性信息
# ✓ 显示网络工具的可用性
# ✓ 显示环境验证结果
# ✓ 命令执行后立即退出
# ✓ 退出代码为 0
```

#### 场景2.2: Claude CLI不可用时的检查
```bash
# 临时重命名Claude CLI进行测试
which claude  # 记录原始路径
sudo mv $(which claude) $(which claude).backup 2>/dev/null || echo "Claude not in PATH"

./claude-auto-resume.sh --check

# 期望输出（Claude CLI部分）：
# Claude CLI Information:
#   Status: Not found
#   [ERROR] Claude CLI not found in PATH
# 
# Environment Validation:
#   Claude CLI: ✗ Not found
#   Network connectivity: ✓ Connected (或 ✗ Failed)

# 恢复Claude CLI
CLAUDE_PATH=$(which claude.backup 2>/dev/null || echo "/usr/local/bin/claude")
sudo mv "${CLAUDE_PATH}" "${CLAUDE_PATH%.backup}" 2>/dev/null || echo "No backup to restore"

# 验证点：
# ✓ 正确检测Claude CLI不可用状态
# ✓ 显示适当的错误信息
# ✓ 其他检查项目仍然正常工作
# ✓ 仍然显示完整的系统信息
```

#### 场景2.3: 网络连接失败时的检查
```bash
# 方法1：断开网络连接
# 断开WiFi或以太网，然后运行
./claude-auto-resume.sh --check

# 方法2：使用防火墙规则阻止连接（需要管理员权限）
# sudo iptables -A OUTPUT -j DROP  # Linux
# 或者断开网络连接

# 期望输出（网络连接部分）：
# Environment Validation:
#   Claude CLI: ✓ Available (或 ✗ Not found)
#   Network connectivity: ✗ Failed

# 验证点：
# ✓ 正确检测网络连接失败
# ✓ 显示适当的网络状态
# ✓ 其他检查项目仍然正常工作
```

### AC3: 版本输出应该清晰一致

#### 场景3.1: 版本格式验证
```bash
# 测试版本输出格式
VERSION_OUTPUT=$(./claude-auto-resume.sh --version)
echo "输出: $VERSION_OUTPUT"

# 使用正则表达式验证格式
if echo "$VERSION_OUTPUT" | grep -qE "^claude-auto-resume v[0-9]+\.[0-9]+\.[0-9]+$"; then
    echo "✓ 版本格式正确"
else
    echo "✗ 版本格式不正确"
fi

# 验证点：
# ✓ 格式严格匹配 "claude-auto-resume v{major}.{minor}.{patch}"
# ✓ 版本号只包含数字和点
# ✓ 输出简洁，无额外信息
```

### AC4: 检查命令应显示全面的系统信息

#### 场景4.1: 系统信息完整性验证
```bash
CHECK_OUTPUT=$(./claude-auto-resume.sh --check)

# 验证每个必需的信息块
echo "$CHECK_OUTPUT" | grep -q "Script Information:" && echo "✓ 脚本信息部分存在" || echo "✗ 缺少脚本信息"
echo "$CHECK_OUTPUT" | grep -q "Claude CLI Information:" && echo "✓ Claude CLI信息部分存在" || echo "✗ 缺少Claude CLI信息"
echo "$CHECK_OUTPUT" | grep -q "System Compatibility:" && echo "✓ 系统兼容性部分存在" || echo "✗ 缺少系统兼容性"
echo "$CHECK_OUTPUT" | grep -q "Network Utilities:" && echo "✓ 网络工具部分存在" || echo "✗ 缺少网络工具"
echo "$CHECK_OUTPUT" | grep -q "Environment Validation:" && echo "✓ 环境验证部分存在" || echo "✗ 缺少环境验证"

# 验证特定信息
echo "$CHECK_OUTPUT" | grep -q "Version: 1.2.0" && echo "✓ 显示脚本版本" || echo "✗ 缺少脚本版本"
echo "$CHECK_OUTPUT" | grep -q "Location:.*claude-auto-resume.sh" && echo "✓ 显示脚本位置" || echo "✗ 缺少脚本位置"

# 验证点：
# ✓ 包含所有必需的信息部分
# ✓ 每个部分都有具体的信息内容
# ✓ 信息格式清晰易读
```

### AC5: 两个标志都应作为独立命令工作

#### 场景5.1: 独立命令退出验证
```bash
# 测试--version独立退出
echo "测试--version退出行为..."
timeout 5s ./claude-auto-resume.sh --version
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ --version正确退出，退出代码: $EXIT_CODE"
else
    echo "✗ --version退出异常，退出代码: $EXIT_CODE"
fi

# 测试--check独立退出
echo "测试--check退出行为..."
timeout 5s ./claude-auto-resume.sh --check > /dev/null
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ --check正确退出，退出代码: $EXIT_CODE"
else
    echo "✗ --check退出异常，退出代码: $EXIT_CODE"
fi

# 验证点：
# ✓ 两个命令都在5秒内完成（不会等待或挂起）
# ✓ 退出代码都是0（成功）
# ✓ 不会继续执行脚本的主要逻辑
```

#### 场景5.2: 不触发主要逻辑验证
```bash
# 确保版本和检查命令不会触发网络检查或Claude CLI执行
echo "验证--version不触发主要逻辑..."
OUTPUT=$(./claude-auto-resume.sh --version 2>&1)
if echo "$OUTPUT" | grep -q "Checking network connectivity"; then
    echo "✗ --version错误地触发了网络检查"
else
    echo "✓ --version正确地跳过了主要逻辑"
fi

echo "验证--check不触发主要逻辑..."
OUTPUT=$(./claude-auto-resume.sh --check 2>&1)
if echo "$OUTPUT" | grep -q "Executing Claude CLI command"; then
    echo "✗ --check错误地触发了Claude CLI执行"
else
    echo "✓ --check正确地跳过了主要逻辑"
fi

# 验证点：
# ✓ 版本和检查命令不执行网络连接检查
# ✓ 不执行Claude CLI命令
# ✓ 不进入等待或重试逻辑
```

### AC6: 版本信息应该易于维护和更新

#### 场景6.1: 版本变量可维护性验证
```bash
# 检查脚本中的版本定义
echo "检查版本变量定义..."
if grep -q 'VERSION="1.2.0"' claude-auto-resume.sh; then
    echo "✓ 发现VERSION变量定义"
    
    # 检查版本变量位置（应该在脚本顶部）
    LINE_NUM=$(grep -n '^VERSION=' claude-auto-resume.sh | head -1 | cut -d: -f1)
    if [ $LINE_NUM -lt 20 ]; then
        echo "✓ VERSION变量在脚本顶部（第${LINE_NUM}行）"
    else
        echo "✗ VERSION变量位置太靠后（第${LINE_NUM}行）"
    fi
    
    # 检查是否只有一个主VERSION定义（排除CLAUDE_VERSION等其他变量）
    VERSION_COUNT=$(grep -c '^VERSION=' claude-auto-resume.sh)
    if [ $VERSION_COUNT -eq 1 ]; then
        echo "✓ 只有一个VERSION变量定义"
    else
        echo "✗ 发现多个VERSION定义（$VERSION_COUNT个）"
    fi
else
    echo "✗ 未找到VERSION变量定义"
fi

# 验证点：
# ✓ VERSION变量在脚本顶部明确定义
# ✓ 只有一个版本定义点
# ✓ 变量命名清晰易识别
```

### AC7: 遵循标准CLI约定

#### 场景7.1: CLI约定验证
```bash
echo "验证CLI标志约定..."

# 测试短标志格式
./claude-auto-resume.sh -v > /dev/null && echo "✓ 短标志 -v 工作正常" || echo "✗ 短标志 -v 失败"

# 测试长标志格式
./claude-auto-resume.sh --version > /dev/null && echo "✓ 长标志 --version 工作正常" || echo "✗ 长标志 --version 失败"
./claude-auto-resume.sh --check > /dev/null && echo "✓ 长标志 --check 工作正常" || echo "✗ 长标志 --check 失败"

# 验证帮助文档包含新标志
if ./claude-auto-resume.sh --help | grep -q "\-v, \-\-version.*Show version information"; then
    echo "✓ 帮助文档包含版本标志说明"
else
    echo "✗ 帮助文档缺少版本标志说明"
fi

if ./claude-auto-resume.sh --help | grep -q "\-\-check.*Show system check information"; then
    echo "✓ 帮助文档包含检查标志说明"
else
    echo "✗ 帮助文档缺少检查标志说明"
fi

# 验证点：
# ✓ 支持标准的短标志和长标志格式
# ✓ 帮助文档正确列出所有新标志
# ✓ 标志命名遵循常见CLI工具约定
```

#### 场景7.2: 错误处理验证
```bash
echo "验证错误处理..."

# 测试无效标志
OUTPUT=$(./claude-auto-resume.sh --invalid-flag 2>&1)
if echo "$OUTPUT" | grep -q "Unknown option: --invalid-flag"; then
    echo "✓ 正确处理无效标志"
else
    echo "✗ 无效标志处理异常"
fi

# 验证错误后显示帮助
if echo "$OUTPUT" | grep -q "Usage: claude-auto-resume"; then
    echo "✓ 错误后显示帮助信息"
else
    echo "✗ 错误后未显示帮助信息"
fi

# 验证点：
# ✓ 未知标志产生适当错误消息
# ✓ 错误后显示使用帮助
# ✓ 保持现有错误处理行为
```

## 兼容性验证

### 场景8: 向后兼容性测试
```bash
echo "验证向后兼容性..."

# 测试现有标志仍然工作
timeout 5s ./claude-auto-resume.sh --help > /dev/null && echo "✓ --help 仍然工作" || echo "✗ --help 损坏"

# 测试现有参数解析
echo "测试现有参数解析（会因网络检查而超时，这是正常的）..."
timeout 3s ./claude-auto-resume.sh -p "test prompt" 2>&1 | grep -q "Checking network connectivity" && echo "✓ 现有 -p 标志仍然工作" || echo "✗ 现有 -p 标志损坏"

timeout 3s ./claude-auto-resume.sh -c "test" 2>&1 | grep -q "Checking network connectivity" && echo "✓ 现有 -c 标志仍然工作" || echo "✗ 现有 -c 标志损坏"

# 验证点：
# ✓ 所有现有功能保持不变
# ✓ 现有参数解析逻辑正常工作
# ✓ 新功能不影响原有行为
```

## 验收完成检查清单

完成所有验收测试后，使用以下检查清单确保功能正常：

### 版本管理功能
- [ ] ✅ `--version` 显示正确格式的版本信息
- [ ] ✅ `-v` 短标志工作正常
- [ ] ✅ 版本输出格式一致且清晰
- [ ] ✅ 版本信息易于维护（单一VERSION变量）

### 系统检查功能
- [ ] ✅ `--check` 显示完整系统信息
- [ ] ✅ 包含脚本版本和位置信息
- [ ] ✅ 显示Claude CLI详细状态
- [ ] ✅ 包含系统兼容性信息
- [ ] ✅ 显示网络工具可用性
- [ ] ✅ 显示环境验证结果

### CLI约定遵循
- [ ] ✅ 支持标准短/长标志格式
- [ ] ✅ 帮助文档包含新标志说明
- [ ] ✅ 错误处理正确且一致
- [ ] ✅ 未知标志产生适当错误消息

### 独立命令行为
- [ ] ✅ 两个标志都立即退出（不挂起）
- [ ] ✅ 退出代码正确（0表示成功）
- [ ] ✅ 不触发主要脚本逻辑
- [ ] ✅ 不执行网络检查或Claude CLI命令

### 兼容性验证
- [ ] ✅ 现有功能完全保持不变
- [ ] ✅ 现有参数解析正常工作
- [ ] ✅ 帮助系统正确更新
- [ ] ✅ 脚本语法有效

### 特殊场景处理
- [ ] ✅ Claude CLI不可用时的优雅处理
- [ ] ✅ 网络连接失败时的正确显示
- [ ] ✅ 混合参数时的正确优先级处理

## 验收标准

### 必须通过的标准
1. **功能完整性**：所有7个验收标准都必须通过
2. **兼容性**：现有功能不受影响
3. **稳定性**：新功能不会导致脚本崩溃或挂起
4. **用户体验**：信息显示清晰，易于理解

### 可选优化建议
1. **性能**：--check命令应在合理时间内完成（<5秒）
2. **信息丰富度**：系统信息应该足够详细以便故障排除
3. **格式美观**：输出格式应该清晰易读

## 验收报告模板

完成验收后，请记录以下信息：

```
验收日期：
验收人员：
测试环境：
- 操作系统：
- Shell版本：
- Claude CLI状态：
- 网络连接状态：

验收结果：
- 通过的测试场景：___/___
- 失败的测试场景：
- 发现的问题：
- 建议的改进：

总体评估：[ ] 通过验收 [ ] 需要修复后重新验收

备注：
```

---

**注意**：本文档中的所有测试都应该在非生产环境中进行。某些测试可能需要管理员权限或会暂时影响网络连接。