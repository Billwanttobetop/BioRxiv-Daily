# BioRxiv日报 - 开发指南

## 开发环境搭建

### 系统要求

- **Node.js**: 18.0.0 或更高版本
- **pnpm**: 8.0.0 或更高版本
- **Git**: 最新版本
- **VS Code**: 推荐编辑器

### 快速开始

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd biorxiv-daily
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **设置环境变量**
   ```bash
   cp .env.example .env.local
   # 编辑 .env.local 文件，配置您的Supabase信息
   ```

4. **启动开发服务器**
   ```bash
   pnpm dev
   ```

5. **访问应用**
   - 前端应用: http://localhost:5173
   - 管理后台: http://localhost:5173/admin

## 项目架构

### 目录结构

```
src/
├── components/          # 可复用组件
│   ├── ui/             # 基础UI组件
│   ├── forms/          # 表单组件
│   └── layout/         # 布局组件
├── pages/              # 页面组件
│   ├── HomePage.tsx    # 首页
│   ├── AdminPage.tsx   # 管理后台
│   └── ...
├── hooks/              # 自定义Hooks
├── contexts/           # React Context
├── lib/                # 工具库
│   ├── supabase.ts     # Supabase客户端
│   └── utils.ts        # 工具函数
├── types/              # TypeScript类型定义
└── styles/             # 样式文件
```

### 核心概念

#### 1. 组件设计模式

**函数式组件 + Hooks**
```typescript
import React, { useState, useEffect } from 'react';

interface Props {
  title: string;
  onAction: () => void;
}

export const MyComponent: React.FC<Props> = ({ title, onAction }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    // 副作用逻辑
  }, []);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onAction();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <button 
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? 'Loading...' : 'Action'}
      </button>
    </div>
  );
};
```

#### 2. 状态管理

**React Context + useReducer**
```typescript
// AuthContext.tsx
import React, { createContext, useContext, useReducer } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ERROR'; payload: string | null };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
};

const AuthContext = createContext<{
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
} | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    loading: true,
    error: null,
  });

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

#### 3. 数据获取模式

**自定义Hook + React Query**
```typescript
// hooks/usePapers.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Paper } from '@/types';

export const usePapers = (filters?: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('papers')
          .select('*')
          .order('published_date', { ascending: false });

        if (filters?.search) {
          query = query.ilike('title', `%${filters.search}%`);
        }

        if (filters?.dateFrom) {
          query = query.gte('published_date', filters.dateFrom);
        }

        if (filters?.dateTo) {
          query = query.lte('published_date', filters.dateTo);
        }

        const { data, error } = await query;

        if (error) throw error;
        setPapers(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPapers();
  }, [filters]);

  return { papers, loading, error, refetch: () => {} };
};
```

## 开发规范

### TypeScript规范

#### 1. 类型定义
```typescript
// types/paper.ts
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  pdf_url: string;
  published_date: string;
  doi: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperAnalysis {
  id: string;
  paper_id: string;
  title_cn: string | null;
  abstract_cn: string | null;
  insights: string | null;
  solutions: string | null;
  limitations: string | null;
  prospects: string | null;
  analyzed_at: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

#### 2. 接口和类型
```typescript
// 组件Props类型
interface ComponentProps {
  // 必需属性
  title: string;
  data: Paper[];
  
  // 可选属性
  onSelect?: (paper: Paper) => void;
  className?: string;
  
  // 事件处理
  onClick?: () => void;
}

// 工具函数类型
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: keyof Paper;
  direction: SortDirection;
}

// API响应类型
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}
```

### React组件规范

#### 1. 组件结构
```typescript
// 好的组件结构
import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};
```

#### 2. 自定义Hooks
```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};
```

### 样式规范

#### 1. Tailwind CSS使用
```typescript
// 组件样式
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
    {children}
  </div>
);

// 响应式设计
const ResponsiveGrid: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* 网格项 */}
  </div>
);

// 暗色模式支持
const ThemeAwareComponent: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
    内容
  </div>
);
```

#### 2. 自定义样式
```css
/* styles/custom.css */

/* 自定义动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 打印样式 */
@media print {
  .no-print {
    display: none !important;
  }
  
  .print-break {
    page-break-after: always;
  }
}
```

## 数据库操作

### Supabase客户端使用

#### 1. 基本查询
```typescript
// 查询论文列表
const fetchPapers = async (page = 1, pageSize = 20) => {
  const { data, error, count } = await supabase
    .from('papers')
    .select('*', { count: 'exact' })
    .order('published_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw error;
  return { data, count };
};

// 搜索论文
const searchPapers = async (query: string) => {
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .or(`title.ilike.%${query}%,abstract.ilike.%${query}%`)
    .order('published_date', { ascending: false });

  if (error) throw error;
  return data;
};
```

#### 2. 复杂查询
```typescript
// 获取论文及分析结果
const fetchPapersWithAnalysis = async (paperIds: string[]) => {
  const { data: papers, error: papersError } = await supabase
    .from('papers')
    .select('*')
    .in('id', paperIds);

  if (papersError) throw papersError;

  const { data: analyses, error: analysisError } = await supabase
    .from('paper_analysis')
    .select('*')
    .in('paper_id', paperIds);

  if (analysisError) throw analysisError;

  // 手动关联数据
  const papersWithAnalysis = papers.map(paper => ({
    ...paper,
    analysis: analyses.find(a => a.paper_id === paper.id) || null,
  }));

  return papersWithAnalysis;
};

// 批量插入数据
const batchInsertPapers = async (papers: Omit<Paper, 'id' | 'created_at' | 'updated_at'>[]) => {
  const { data, error } = await supabase
    .from('papers')
    .insert(papers)
    .select();

  if (error) throw error;
  return data;
};
```

#### 3. 实时订阅
```typescript
// 订阅论文更新
const subscribeToPapers = (callback: (payload: any) => void) => {
  const subscription = supabase
    .channel('papers-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'papers',
      },
      callback
    )
    .subscribe();

  return subscription;
};

// 使用订阅
useEffect(() => {
  const subscription = subscribeToPapers((payload) => {
    console.log('Papers changed:', payload);
    // 更新本地状态
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### 认证集成

#### 1. 用户认证
```typescript
// 登录
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

// 注册
const signUp = async (email: string, password: string, metadata?: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
};

// 登出
const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};
```

#### 2. 权限控制
```typescript
// 检查用户权限
const checkUserRole = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role || null;
};

// 受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({
  children,
  requiredRole,
}) => {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (user) {
        const userRole = await checkUserRole(user.id);
        setRole(userRole);
      }
      setLoading(false);
    };

    checkRole();
  }, [user]);

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

## 测试

### 单元测试

#### 1. 组件测试
```typescript
// __tests__/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});
```

#### 2. Hook测试
```typescript
// __tests__/hooks/useDebounce.test.ts
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    expect(result.current).toBe('test');
  });

  it('should return debounced value after delay', async () => {
    jest.useFakeTimers();
    
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
    
    jest.useRealTimers();
  });
});
```

### 集成测试

```typescript
// __tests__/pages/HomePage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '@/pages/HomePage';
import { supabase } from '@/lib/supabase';

// Mock Supabase
jest.mock('@/lib/supabase');
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('HomePage', () => {
  beforeEach(() => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: [
              {
                id: '1',
                title: 'Test Paper',
                authors: ['Author 1'],
                published_date: '2024-01-01',
              },
            ],
            error: null,
          }),
        }),
      }),
    } as any);
  });

  it('renders papers list', async () => {
    render(<HomePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Paper')).toBeInTheDocument();
    });
  });
});
```

## 调试和开发工具

### VS Code配置

#### 1. 推荐扩展
```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-thunder-client"
  ]
}
```

#### 2. 设置配置
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

#### 3. 调试配置
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Vite",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vite",
      "args": ["--host", "--port", "5173"],
      "env": {
        "NODE_OPTIONS": "--inspect"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--nolazy"]
    }
  ]
}
```

### 性能监控

#### 1. React DevTools
```typescript
// 在开发环境中启用性能监控
if (process.env.NODE_ENV === 'development') {
  // React DevTools Profiler
  import('react-dom/profiling');
}
```

#### 2. 自定义性能监控
```typescript
// utils/performance.ts
export const measurePerformance = (name: string, fn: () => void | Promise<void>) => {
  const start = performance.now();
  
  const finish = () => {
    const end = performance.now();
    console.log(`${name} took ${end - start} milliseconds`);
  };

  if (fn instanceof Promise) {
    return fn.finally(finish);
  } else {
    fn();
    finish();
  }
};

// 使用示例
const fetchData = async () => {
  return measurePerformance('fetchData', async () => {
    const response = await fetch('/api/data');
    return response.json();
  });
};
```

## 常见开发问题

### 1. TypeScript错误

**问题**: 类型不匹配
```typescript
// 错误示例
const papers: Paper[] = await supabase.from('papers').select('*');
// Type 'any[]' is not assignable to type 'Paper[]'

// 解决方案
const { data, error } = await supabase.from('papers').select('*');
if (error) throw error;
const papers: Paper[] = data || [];
```

### 2. 状态管理问题

**问题**: 状态更新时机
```typescript
// 问题: 异步状态更新
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true); // 立即设置为true
  try {
    await apiCall();
  } catch (error) {
    console.error(error);
  }
  setLoading(false); // 即使出错也会执行
};

// 解决方案: 使用try-finally
const handleSubmit = async () => {
  setLoading(true);
  try {
    await apiCall();
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

### 3. 组件重新渲染问题

**问题**: 过度重新渲染
```typescript
// 问题: 对象字面量作为props
<MyComponent 
  style={{ color: 'red' }}
  onClick={() => handleClick()}
/>

// 解决方案: 使用useMemo和useCallback
const style = useMemo(() => ({ color: 'red' }), []);
const handleClick = useCallback(() => {
  // 处理点击
}, []);

<MyComponent style={style} onClick={handleClick} />
```

### 4. 异步数据处理

**问题**: 竞态条件
```typescript
// 问题: 多个异步请求
const [data, setData] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    const response = await fetch('/api/data');
    const result = await response.json();
    setData(result);
  };

  fetchData();
}, []);

// 解决方案: 使用AbortController
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data', {
        signal: controller.signal,
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
      }
    }
  };

  fetchData();

  return () => controller.abort();
}, []);
```

## 总结

本开发指南涵盖了BioRxiv日报项目的主要开发实践和规范。遵循这些指南可以确保代码质量和开发效率。

### 关键要点

1. **类型安全**: 始终使用TypeScript类型定义
2. **组件设计**: 遵循单一职责原则和可复用性
3. **状态管理**: 合理使用Context和Hooks
4. **错误处理**: 完善的错误边界和异常处理
5. **测试覆盖**: 单元测试和集成测试并重
6. **性能优化**: 避免不必要的重新渲染和内存泄漏

### 进一步学习

- [React官方文档](https://react.dev/)
- [TypeScript手册](https://www.typescriptlang.org/docs/)
- [Tailwind CSS文档](https://tailwindcss.com/docs)
- [Supabase文档](https://supabase.com/docs)

---

**下一步**: 查看 [环境变量配置](./ENVIRONMENT_VARIABLES.md) 了解详细配置选项
