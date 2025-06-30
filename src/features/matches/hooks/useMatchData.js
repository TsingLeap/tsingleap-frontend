import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { getMatches, getUserPermissionInfo, getFocusCompetitionList, addCompetitionFocus, delCompetitionFocus } from '../../../services/api';
import { getUser } from '../../../utils/auth';

export function useMatchData() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userPermissions, setUserPermissions] = useState([]);
  const [queryFinishedStatus, setQueryFinishedStatus] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' 或 'focus'
  const [focusLoading, setFocusLoading] = useState(false);
  const currentUser = getUser();

  // 1. 获取用户权限（仅依赖 username）
  const fetchUserPermissions = useCallback(async () => {
    if (!currentUser?.username) {
      setUserPermissions([]);
      return;
    }
    try {
      const res = await getUserPermissionInfo(currentUser.username);
      if (res.code === 0) {
        setUserPermissions(res.data || []);
      } else {
        message.error('无法加载用户权限信息');
      }
    } catch {
      message.error('获取用户权限网络错误');
    }
  }, [currentUser?.username]);

  // 2. 拉取赛事列表
  //    - initial=true：第一页，传 { before_time:'', before_id:-1 }
  //    - initial=false：加载更多，由调用者传入游标
  const fetchMatches = useCallback(async (initial, cursor) => {
    if (initial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let res;
      if (viewMode === 'all') {
        // 传入当前用户ID，用于获取关注状态
        res = await getMatches(cursor, queryFinishedStatus, currentUser?.id || -1);
      } else {
        // 获取关注的比赛列表
        if (!currentUser?.id) {
          message.error('请先登录');
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        res = await getFocusCompetitionList(currentUser.id, cursor, queryFinishedStatus);
      }
      
      if (res.code === 0) {
        const list = res.data?.competition_list || [];
        setMatches(prev => initial ? list : [...prev, ...list]);
        // Check if the API explicitly signals no more data OR if the returned list is empty
        const noMore = list.length === 0 || res.code === 1100;
        setHasMore(!noMore);
      } else if (res.code === 1100) { // Specific code indicating end of data
        setHasMore(false);
      } else {
        // 只在"全部"模式下显示错误，或者在"关注"模式下只有真正的API错误时才显示
        console.error("Fetch Matches Error:", res.msg);
        
        // 是否需要显示错误消息
        // 在关注模式下，只有在严重错误（非空列表或结束数据）时才显示错误
        const shouldShowError = viewMode === 'all' || 
            (viewMode === 'focus' && res.code !== 0 && res.code !== 1100);
        
        if (shouldShowError) {
          message.error(res.msg || (initial ? '加载赛事列表失败' : '加载更多赛事失败'));
        }
        setHasMore(false); // Assume error means no more can be loaded reliably
      }
    } catch (error) { // Catch network or unexpected errors
        console.error("Fetch Matches Error:", error); // Log the error for debugging
        
        // 在关注模式下，如果是因为没有关注赛事而导致的错误，不显示错误消息
        const isEmptyFocusListError = viewMode === 'focus' && (
            error.message?.includes('empty') || 
            error.message?.includes('no matches') ||
            error.response?.status === 404
        );
        
        // 仅在非空列表错误时显示错误消息
        if (!isEmptyFocusListError) {
          // 避免在用户刷新时显示错误
          if (!(initial && viewMode === 'focus' && !currentUser?.id)) {
            message.error('网络错误，无法加载赛事');
          }
        }
        setHasMore(false); // Assume error means no more can be loaded
    } finally {
      if (initial) setLoading(false);
      else setLoadingMore(false);
    }
  }, [queryFinishedStatus, viewMode, currentUser?.id]); // fetchMatches depends on the finished status filter and view mode

  // 3. 初次加载 & 标签切换时拉第一页
  useEffect(() => {
    console.log("视图模式或完成状态变化，重新获取数据:", { viewMode, queryFinishedStatus });
    // 只有在初次加载或视图模式/完成状态变化时才重新拉取数据
    setMatches([]); // Clear matches on filter change
    setHasMore(true); // Reset hasMore
    fetchMatches(true, { before_time: '', before_id: -1 }); // Fetch first page
  }, [queryFinishedStatus, viewMode]); // 只依赖这两个变量，不依赖fetchMatches避免重复渲染

  // 4. 加载用户权限一次
  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]); // Depends on the stable fetchUserPermissions function

  // 5. 切换进行中/已结束
  const handleStatusChange = useCallback(newStatus => {
    if (newStatus !== queryFinishedStatus) {
      console.log(`切换完成状态：从 ${queryFinishedStatus} 到 ${newStatus}`);
      setQueryFinishedStatus(newStatus);
      // 状态变化由useEffect中的依赖变化触发数据获取
    } else {
      console.log(`完成状态未变化，保持 ${newStatus}`);
    }
  }, [queryFinishedStatus]); // 依赖当前状态，确保只在状态真正变化时才更新

  // 6. 加载更多 (called by UI, e.g., infinite scroll or button)
  const loadMoreMatches = useCallback(() => {
    // Guards: Don't fetch if already loading, or no more data
    if (loading || loadingMore || !hasMore) {
        console.log("Load more skipped:", { loading, loadingMore, hasMore }); // Debug log
        return;
    }

    const last = matches[matches.length - 1];
    if (!last) {
        console.log("Load more skipped: No last match found. Possibly initial load failed or was empty."); // Debug log
        // Optionally, try to fetch the first page again if list is empty
        // fetchMatches(true, { before_time: '', before_id: -1 });
        return;
    }

    console.log("Executing loadMoreMatches, last item:", last); // Debug log
    // Fetch next page using the cursor from the last item
    fetchMatches(false, { before_time: last.time_begin, before_id: last.id });

  }, [loading, loadingMore, hasMore, matches, fetchMatches]); // Dependencies for loadMoreMatches

  // 7. 手动刷新列表
  const refreshCurrentList = useCallback(() => {
    setMatches([]); // Clear current matches
    setHasMore(true); // Reset hasMore flag
    // Fetch the first page again based on the current filter status
    fetchMatches(true, { before_time: '', before_id: -1 });
  }, [fetchMatches]); // Depends on the stable fetchMatches function

  // 8. 权限判断 (Memoized using values derived from userPermissions state)
  const canManageMatches = userPermissions.some(p => p.permission_name === 'match.manage_match');

  const canUpdateSpecificMatch = useCallback(
    id => userPermissions.some(p =>
      p.permission_name === 'match.update_match_info' &&
      p.permission_info === String(id) // Ensure comparison is string vs string
    ),
    [userPermissions] // Re-calculate only if userPermissions changes
  );

  const canUpdate = useCallback(id => canManageMatches || canUpdateSpecificMatch(id), [canManageMatches, canUpdateSpecificMatch]);

  const canDelete = canManageMatches; // Delete depends only on the global manage permission

  // 处理关注/取消关注的函数，统一入口
  const handleFocusMatch = useCallback(async (matchId) => {
    if (!currentUser?.id) {
      message.error('请先登录');
      return false;
    }
    
    try {
      const res = await addCompetitionFocus(matchId, currentUser.id);
      if (res.code === 0) {
        message.success('关注成功');
        // 更新单条赛事的is_focus属性
        setMatches(prev => prev.map(match => 
          match.id === matchId ? { ...match, is_focus: true } : match
        ));
        return true;
      } else if (res.code === 1106) {
        message.info('已经关注过该赛事');
        // 确保该赛事的is_focus状态正确
        setMatches(prev => prev.map(match => 
          match.id === matchId ? { ...match, is_focus: true } : match
        ));
        return true;
      } else {
        message.error(res.msg || '关注失败');
        return false;
      }
    } catch (error) {
      console.error('关注赛事出错:', error);
      message.error('网络错误，关注失败');
      return false;
    }
  }, [currentUser?.id]);
  
  // 取消关注比赛
  const handleUnfocusMatch = useCallback(async (matchId) => {
    if (!currentUser?.id) {
      message.error('请先登录');
      return false;
    }
    
    try {
      const res = await delCompetitionFocus(matchId, currentUser.id);
      if (res.code === 0) {
        message.success('取消关注成功');
        
        // 如果当前是关注视图，需要从列表中移除该赛事
        if (viewMode === 'focus') {
          setMatches(prev => prev.filter(match => match.id !== matchId));
        } else {
          // 更新单条赛事的is_focus属性
          setMatches(prev => prev.map(match => 
            match.id === matchId ? { ...match, is_focus: false } : match
          ));
        }
        return true;
      } else if (res.code === 1108) {
        message.info('未关注该赛事');
        // 更新单条赛事的is_focus属性
        setMatches(prev => prev.map(match => 
          match.id === matchId ? { ...match, is_focus: false } : match
        ));
        return true;
      } else {
        message.error(res.msg || '取消关注失败');
        return false;
      }
    } catch (error) {
      console.error('取消关注赛事出错:', error);
      message.error('网络错误，取消关注失败');
      return false;
    }
  }, [currentUser?.id, viewMode]);

  // 切换视图模式（全部/关注）
  const switchViewMode = useCallback((mode) => {
    if (!currentUser?.id && mode === 'focus') {
      message.error('请先登录');
      return;
    }
    
    if (mode !== viewMode) {
      console.log(`切换视图模式：从 ${viewMode} 到 ${mode}`);
      // 不在这里清空列表，而是在useEffect中统一处理，避免重复渲染
      setViewMode(mode);
      // 视图切换由useEffect中的依赖变化触发数据获取
    } else {
      console.log(`视图模式未变化，保持 ${mode} 模式`);
    }
  }, [viewMode, currentUser?.id]);

  // Return all state and functions needed by the component
  return {
    matches,
    loading,          // For initial loading state
    loadingMore,      // For loading state triggered by loadMoreMatches
    hasMore,          // To indicate if more data is available
    queryFinishedStatus, // The current filter state (false=ongoing/upcoming, true=finished)
    canManageMatches, // Boolean: Can user create/delete/manage all matches?
    canUpdateSpecificMatch, // Function(id): Can user update score/status for specific match ID?
    canUpdate,        // Function(id): Can user edit (full or score-only) specific match ID?
    canDelete,        // Boolean: Can user delete matches? (Currently same as canManageMatches)
    handleStatusChange, // Function(newStatus): To change the filter tab
    loadMoreMatches,  // Function(): To trigger loading the next page of data
    refreshCurrentList, // Function(): To manually refresh the current list view
    // 关注相关功能
    viewMode,         // String: 当前视图模式 ('all' 或 'focus')
    switchViewMode,   // Function(mode): 切换视图模式
    focusLoading,     // Boolean: 获取关注状态时的加载状态
    handleFocusMatch, // Function(matchId): 关注比赛
    handleUnfocusMatch, // Function(matchId): 取消关注比赛
    isMatchFocused: (matchId) => {
      // 通过matchId在matches中查找对应比赛，并返回其is_focus属性
      const match = matches.find(m => m.id === matchId);
      return match ? Boolean(match.is_focus) : false;
    }
  };
}