import React, { useState, useCallback, useRef, useEffect } from 'react'; // Import useRef and useEffect
import { List, Button, Card, Typography, Space, Spin, Tabs, message, Radio, Input } from 'antd';
import { TagOutlined, SearchOutlined } from '@ant-design/icons';
import moment from 'moment';

// Import Hooks and Components
import { useMatchData } from './hooks/useMatchData';
import MatchCard from './components/MatchCard';
import MatchFormModal from './components/MatchFormModal';
import GrantPermissionModal from './components/GrantPermissionModal';
import ManageUpdatersModal from './components/ManageUpdatersModal';
import TagSelector from '../../components/TagSelector';
import { getUser } from '../../utils/auth';

// Import API functions
import {
    createMatch,
    updateMatch,
    deleteMatch,
    getTagList,
    getCompetitionListByTag,
    searchTagByPrefix,
    getMatches,
    getTagListByCompetition,
} from '../../services/api';

const { Title, Text } = Typography;
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';

// 根据标签类型返回颜色
const getTagColorByType = (tagType) => {
  switch (tagType) {
    case 'sports':
      return 'blue';
    case 'department':
      return 'green';
    case 'highlight':
      return 'red';
    case 'event':
      return 'orange';
    default:
      return 'default';
  }
};

// 在筛选卡片部分使用TagSelector
const FilterCard = ({
  selectedTags,
  setSelectedTags,
  searchText,
  setSearchText,
  performSearch,
  clearAllFilters,
  searchLoading,
  isSearching,
  searchResults,
}) => (
  <>
    <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="搜索赛事名称、运动项目等"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={performSearch}
            style={{ marginBottom: 16 }}
            allowClear
          />
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <TagOutlined style={{ marginRight: 8 }} />
          <Typography.Text strong>按标签筛选</Typography.Text>
        </div>
        <TagSelector
          value={selectedTags}
          onChange={setSelectedTags}
          onlyCompetitionTags={true}
          placeholder="选择标签进行筛选"
        />
      </Space>
    </Card>

    <Card size="small">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          type="primary" 
          onClick={performSearch}
          loading={searchLoading}
        >
          搜索
        </Button>
      </div>
    </Card>
  </>
);

const MatchList = () => {
    // Use custom Hook for data fetching and permissions
    const {
        matches, loading, loadingMore, hasMore, queryFinishedStatus,
        canManageMatches, canUpdateSpecificMatch, canUpdate, canDelete,
        handleStatusChange, loadMoreMatches, refreshCurrentList,
        // 新增关注相关状态和函数
        viewMode, switchViewMode, focusedMatchIds, handleFocusMatch, handleUnfocusMatch, isMatchFocused
    } = useMatchData();

    const currentUser = getUser();
    const isUserLoggedIn = !!currentUser;

    // 标签过滤相关状态
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [tagsLoading, setTagsLoading] = useState(false);
    const [searchText, setSearchText] = useState('');  // 搜索文本
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTagType, setSearchTagType] = useState('notype');  // 标签类型筛选
    const [lastSearchText, setLastSearchText] = useState('');  // 最后一次搜索的文本
    const [lastSearchTags, setLastSearchTags] = useState([]);  // 最后一次搜索的标签
    
    // 新增搜索瀑布刷新相关状态
    const [searchLoadingMore, setSearchLoadingMore] = useState(false);
    const [searchHasMore, setSearchHasMore] = useState(true);

    // 自定义的关注处理函数，能够同时更新 matches 和 searchResults
    const handleFocusMatchWithSearch = useCallback(async (matchId) => {
        const result = await handleFocusMatch(matchId);
        if (result && isSearching) {
            // 如果在搜索状态下，也要更新搜索结果中的关注状态
            setSearchResults(prev => prev.map(match => 
                match.id === matchId ? { ...match, is_focus: true } : match
            ));
        }
        return result;
    }, [handleFocusMatch, isSearching]);

    const handleUnfocusMatchWithSearch = useCallback(async (matchId) => {
        const result = await handleUnfocusMatch(matchId);
        if (result && isSearching) {
            // 如果在搜索状态下，也要更新搜索结果中的关注状态
            if (viewMode === 'focus') {
                // 在关注视图下，取消关注后从搜索结果中移除
                setSearchResults(prev => prev.filter(match => match.id !== matchId));
            } else {
                // 在全部视图下，只更新关注状态
                setSearchResults(prev => prev.map(match => 
                    match.id === matchId ? { ...match, is_focus: false } : match
                ));
            }
        }
        return result;
    }, [handleUnfocusMatch, isSearching, viewMode]);

    // 自定义的 isMatchFocused 函数，能够在搜索和非搜索状态下正确工作
    const isMatchFocusedWithSearch = useCallback((matchId) => {
        if (isSearching) {
            // 在搜索状态下，从搜索结果中查找
            const match = searchResults.find(m => m.id === matchId);
            return match ? Boolean(match.is_focus) : false;
        } else {
            // 在非搜索状态下，使用原来的函数
            return isMatchFocused(matchId);
        }
    }, [isSearching, searchResults, isMatchFocused]);

    // 获取标签列表
    useEffect(() => {
        const fetchTags = async () => {
            setTagsLoading(true);
            try {
                const tagTypeParam = searchTagType === 'notype' ? '' : searchTagType;
                const res = await searchTagByPrefix('', tagTypeParam);
                if (res.code === 0) {
                    // 过滤出赛事标签
                    const competitionTags = res.data.filter(tag => tag.is_competition_tag);
                    setTags(competitionTags);
                } else {
                    message.error(res.msg || '标签加载失败');
                }
            } catch (error) {
                message.error('网络错误，无法加载标签');
                console.error('获取标签失败:', error);
            } finally {
                setTagsLoading(false);
            }
        };

        fetchTags();
    }, [searchTagType]);

    // 统一的搜索函数 - 只在点击搜索按钮或按回车时调用
    const performSearch = useCallback(async () => {
        // 如果正在加载中，不允许再次触发搜索
        if (searchLoading) {
            return;
        }
        
        setSearchLoading(true);
        // 清空之前的搜索结果
        setSearchResults([]);
        // 重置搜索瀑布刷新状态
        setSearchHasMore(true);
        
        try {
            const userId = currentUser?.id || -1;
            console.log("用户手动触发搜索，参数：", {
                视图模式: viewMode,
                用户ID: userId,
                状态: queryFinishedStatus ? '已结束' : '进行中/未开始',
                标签: selectedTags,
                搜索文本: searchText
            });
            
            const res = await getMatches(
                { before_time: '', before_id: -1 },
                queryFinishedStatus,  // 进行中/已结束
                userId,
                selectedTags,         // 标签筛选
                searchText,           // 搜索文本
                viewMode === 'focus'  // 全部赛事/我的关注
            );
            
            if (res.code === 0) {
                const list = res.data.competition_list || [];
                setSearchResults(list);
                setIsSearching(true);
                // 记录本次搜索的条件
                setLastSearchText(searchText);
                setLastSearchTags([...selectedTags]);
                // 检查是否还有更多数据
                const noMore = list.length === 0 || res.code === 1100;
                setSearchHasMore(!noMore);
            } else if (res.code === 1100) {
                setSearchResults([]);
                setIsSearching(true);
                setLastSearchText(searchText);
                setLastSearchTags([...selectedTags]);
                setSearchHasMore(false);
                message.info('没有找到符合条件的赛事');
            } else {
                message.error(res.msg || '搜索失败');
            }
        } catch (error) {
            console.error('搜索错误:', error);
            message.error('网络错误，搜索失败');
        } finally {
            setSearchLoading(false);
        }
    }, [currentUser, queryFinishedStatus, selectedTags, searchText, viewMode, searchLoading]);

    // 加载更多搜索结果的函数
    const loadMoreSearchResults = useCallback(async () => {
        // 如果正在加载或没有更多数据，则不执行
        if (searchLoadingMore || !searchHasMore || searchResults.length === 0) {
            console.log("Load more search results skipped:", { searchLoadingMore, searchHasMore, searchResultsLength: searchResults.length });
            return;
        }

        const lastResult = searchResults[searchResults.length - 1];
        if (!lastResult) {
            console.log("Load more search results skipped: No last result found");
            return;
        }

        setSearchLoadingMore(true);
        
        try {
            const userId = currentUser?.id || -1;
            console.log("加载更多搜索结果，参数：", {
                视图模式: viewMode,
                用户ID: userId,
                状态: queryFinishedStatus ? '已结束' : '进行中/未开始',
                标签: lastSearchTags,
                搜索文本: lastSearchText,
                游标: { before_time: lastResult.time_begin, before_id: lastResult.id }
            });
            
            const res = await getMatches(
                { before_time: lastResult.time_begin, before_id: lastResult.id },
                queryFinishedStatus,
                userId,
                lastSearchTags,
                lastSearchText,
                viewMode === 'focus'
            );
            
            if (res.code === 0) {
                const newList = res.data.competition_list || [];
                setSearchResults(prev => [...prev, ...newList]);
                // 检查是否还有更多数据
                const noMore = newList.length === 0;
                setSearchHasMore(!noMore);
            } else if (res.code === 1100) {
                // 没有更多数据
                setSearchHasMore(false);
            } else {
                message.error(res.msg || '加载更多搜索结果失败');
                setSearchHasMore(false);
            }
        } catch (error) {
            console.error('加载更多搜索结果错误:', error);
            message.error('网络错误，加载更多搜索结果失败');
            setSearchHasMore(false);
        } finally {
            setSearchLoadingMore(false);
        }
    }, [searchLoadingMore, searchHasMore, searchResults, currentUser, queryFinishedStatus, lastSearchTags, lastSearchText, viewMode]);

    // 当视图模式（全部/关注）或状态（进行中/已结束）改变时重新搜索
    useEffect(() => {
        // 如果不在搜索状态，则不需要执行搜索逻辑
        if (!isSearching) {
            return;
        }

        // 给视图模式切换一个短暂的延迟，避免与fetchMatches同时执行
        const timer = setTimeout(() => {
            setSearchLoading(true);
            // 清空之前的搜索结果
            setSearchResults([]);
            // 重置搜索瀑布刷新状态
            setSearchHasMore(true);
            
            const userId = currentUser?.id || -1;
            getMatches(
                { before_time: '', before_id: -1 },
                queryFinishedStatus,
                userId,
                selectedTags,
                searchText,
                viewMode === 'focus'
            ).then(res => {
                if (res.code === 0) {
                    const list = res.data.competition_list || [];
                    setSearchResults(list);
                    setLastSearchText(searchText);
                    setLastSearchTags([...selectedTags]);
                    // 检查是否还有更多数据
                    const noMore = list.length === 0;
                    setSearchHasMore(!noMore);
                } else if (res.code === 1100) {
                    setSearchResults([]);
                    setLastSearchText(searchText);
                    setLastSearchTags([...selectedTags]);
                    setSearchHasMore(false);
                    message.info('没有找到符合条件的赛事');
                } else {
                    message.error(res.msg || '搜索失败');
                }
            }).catch(error => {
                console.error('搜索错误:', error);
                message.error('网络错误，搜索失败');
            }).finally(() => {
                setSearchLoading(false);
            });
        }, 100);
        return () => clearTimeout(timer);
    }, [viewMode, queryFinishedStatus]); // 只在视图模式和状态变化时触发

    // 清除所有筛选条件
    const clearAllFilters = useCallback(() => {
        setSelectedTags([]);
        setSearchText('');
        setIsSearching(false);
        setSearchResults([]);
        setLastSearchText('');
        setLastSearchTags([]);
        // 重置搜索瀑布刷新状态
        setSearchHasMore(true);
        setSearchLoadingMore(false);
    }, []);

    // 检查登录状态，确保在focus模式下用户已登录
    useEffect(() => {
        if (viewMode === 'focus' && !currentUser?.id) {
            message.warning('请先登录后再查看关注赛事');
            switchViewMode('all');
        }
    }, [viewMode, currentUser, switchViewMode]);

    // 根据标签筛选赛事
    const handleFilterByTags = useCallback(async () => {
        if (selectedTags.length === 0) {
            setIsSearching(false);
            return;
        }

        setSearchLoading(true);
        try {
            // 根据视图模式决定是否需要筛选用户关注的赛事
            // 'all'模式：user_id = -1（不筛选关注）
            // 'focus'模式：user_id = 当前用户ID（筛选关注）
            const userId = viewMode === 'focus' ? (currentUser?.id || -1) : -1;
            
            console.log(`筛选赛事 - 模式: ${viewMode}, 用户ID: ${userId}, 状态: ${queryFinishedStatus ? '已结束' : '进行中/未开始'}, 标签: ${selectedTags}`);
            
            const res = await getCompetitionListByTag(
                userId,
                selectedTags,
                '',
                -1,
                queryFinishedStatus,
                viewMode === 'focus' // 在关注模式下筛选关注赛事
            );
            
            if (res.code === 0) {
                setSearchResults(res.data.competition_list || []);
                setIsSearching(true);
            } else if (res.code === 1100) {
                // 没有满足条件的比赛
                setSearchResults([]);
                setIsSearching(true);
                message.info('没有找到符合所选标签的赛事');
            } else {
                message.error(res.msg || '标签筛选失败');
            }
        } catch (error) {
            message.error('网络错误，无法筛选赛事');
            console.error('标签筛选赛事失败:', error);
        } finally {
            setSearchLoading(false);
        }
    }, [selectedTags, queryFinishedStatus, currentUser, viewMode]);

    // --- Infinite Scroll Setup ---
    const loaderRef = useRef(null); // Ref for the element to observe
    const searchLoaderRef = useRef(null); // Ref for search results infinite scroll

    useEffect(() => {
        // Ensure loadMoreMatches is defined and IntersectionObserver is available
        if (!loadMoreMatches || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Check if the loader element is intersecting (visible)
                const firstEntry = entries[0];
                if (firstEntry.isIntersecting && hasMore && !loading && !loadingMore) {
                    console.log('Loader intersecting, loading more...'); // Debug log
                    loadMoreMatches(); // Call the function from the hook
                }
            },
            { threshold: 1.0 } // Trigger when 100% of the loader is visible
        );

        const currentLoader = loaderRef.current;
        if (currentLoader) {
            observer.observe(currentLoader); // Start observing
        }

        // Cleanup function: disconnect observer when component unmounts or dependencies change
        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader);
            }
        };
        // Dependencies: Re-run effect if these change. loadMoreMatches should be stable due to useCallback in the hook.
    }, [loadMoreMatches, hasMore, loading, loadingMore]);
    // --- End Infinite Scroll Setup ---

    // --- Search Results Infinite Scroll Setup ---
    useEffect(() => {
        // 只在搜索状态下启用搜索结果的瀑布刷新
        if (!isSearching || !loadMoreSearchResults || typeof IntersectionObserver === 'undefined') return;

        const observer = new IntersectionObserver(
            (entries) => {
                const firstEntry = entries[0];
                if (firstEntry.isIntersecting && searchHasMore && !searchLoading && !searchLoadingMore) {
                    console.log('Search loader intersecting, loading more search results...'); // Debug log
                    loadMoreSearchResults();
                }
            },
            { threshold: 1.0 }
        );

        const currentSearchLoader = searchLoaderRef.current;
        if (currentSearchLoader) {
            observer.observe(currentSearchLoader);
        }

        return () => {
            if (currentSearchLoader) {
                observer.unobserve(currentSearchLoader);
            }
        };
    }, [isSearching, loadMoreSearchResults, searchHasMore, searchLoading, searchLoadingMore]);
    // --- End Search Results Infinite Scroll Setup ---

    // Modal control states
    const [isFormModalVisible, setIsFormModalVisible] = useState(false);
    const [formModalMode, setFormModalMode] = useState('create'); // 'create', 'edit', 'edit_score_only'
    const [currentMatchForModal, setCurrentMatchForModal] = useState(null);
    const [isSubmittingForm, setIsSubmittingForm] = useState(false);

    const [isGrantModalVisible, setIsGrantModalVisible] = useState(false);
    const [matchForGranting, setMatchForGranting] = useState(null);

    const [isManageModalVisible, setIsManageModalVisible] = useState(false);
    const [matchForManaging, setMatchForManaging] = useState(null);

    // --- Modal Opening Handlers --- (Keep existing handlers)
    const openMatchFormModal = useCallback((mode, match = null) => {
        const isScoreOnly = mode === 'edit' && match && canUpdateSpecificMatch(match.id) && !canManageMatches;
        setFormModalMode(isScoreOnly ? 'edit_score_only' : mode);
        setCurrentMatchForModal(match);
        setIsFormModalVisible(true);
    }, [canManageMatches, canUpdateSpecificMatch]);

    const openGrantModal = useCallback((match) => {
        setMatchForGranting(match);
        setIsGrantModalVisible(true);
    }, []);

    const openManageModal = useCallback((match) => {
        setMatchForManaging(match);
        setIsManageModalVisible(true);
    }, []);

    // --- Modal Closing Handlers --- (Keep existing handlers)
    const closeMatchFormModal = useCallback(() => setIsFormModalVisible(false), []);
    const closeGrantModal = useCallback(() => setIsGrantModalVisible(false), []);
    const closeManageModal = useCallback(() => setIsManageModalVisible(false), []);

    // 修改表单提交处理函数
    const handleMatchFormSubmit = useCallback(async (valuesFromModal) => {
        setIsSubmittingForm(true);
        let success = false;
        const timeBeginStr = valuesFromModal.time_begin_str;
        const timeBeginMoment = moment(timeBeginStr, DATETIME_FORMAT, true);

        if (!timeBeginMoment.isValid()) {
            message.error(`提交失败：开赛时间格式无效。请输入 ${DATETIME_FORMAT} 格式。`);
            setIsSubmittingForm(false);
            return;
        }
        const timeBeginISO = timeBeginMoment.toISOString();

        try {
            let res;
            // 处理participants数据，确保score是数字类型
            const participants = valuesFromModal.participants?.map(p => ({
                name: p.name,
                score: Number(p.score) || 0
            })) || [];

            // 基础载荷准备
            const payloadBase = {
                ...valuesFromModal,
                time_begin: timeBeginISO,
                participants,
            };
            
            // 标签处理 - 确保tag_ids始终是数组
            if (valuesFromModal.tag_ids !== undefined) {
                if (Array.isArray(valuesFromModal.tag_ids)) {
                    payloadBase.tag_ids = valuesFromModal.tag_ids;
                } else if (valuesFromModal.tag_ids) {
                    payloadBase.tag_ids = [valuesFromModal.tag_ids];
                } else {
                    payloadBase.tag_ids = [];
                }
                console.log('处理后的标签IDs:', payloadBase.tag_ids);
            } else {
                payloadBase.tag_ids = [];
            }
            
            delete payloadBase.time_begin_str;

            if (formModalMode === 'create') {
                console.log("Creating match with payload:", payloadBase);
                res = await createMatch(payloadBase);
            } else if (formModalMode === 'edit_score_only' && currentMatchForModal) {
                // 在仅更新比分模式下，只更新参赛方分数和比赛状态，但保留标签
                try {
                    // 尝试获取当前标签数据，如果获取失败则使用提交的tag_ids
                    let finalTagIds = payloadBase.tag_ids; // 默认使用表单中的tag_ids
                    
                    // 如果表单中没有tag_ids（因为在edit_score_only模式下标签字段可能被隐藏）
                    // 则尝试从API获取现有标签
                    if (!finalTagIds || finalTagIds.length === 0) {
                        try {
                            const tagRes = await getTagListByCompetition(currentMatchForModal.id);
                            if (tagRes.code === 0 && tagRes.data?.tag_list?.length > 0) {
                                finalTagIds = tagRes.data.tag_list.map(tag => tag.id);
                                console.log('从API获取到的标签IDs:', finalTagIds);
                            }
                        } catch (tagError) {
                            console.error('获取赛事标签失败:', tagError);
                            // 获取失败则使用默认的tag_ids（可能为空数组）
                        }
                    }
                    
                    const scorePayload = {
                        id: currentMatchForModal.id,
                        name: currentMatchForModal.name,
                        sport: currentMatchForModal.sport,
                        time_begin: currentMatchForModal.time_begin,
                        participants: payloadBase.participants,
                        is_finished: payloadBase.is_finished,
                        tag_ids: finalTagIds
                    };
                    
                    console.log(`Updating score for match ${currentMatchForModal.id} with payload:`, scorePayload);
                    res = await updateMatch(currentMatchForModal.id, scorePayload);
                } catch (error) {
                    console.error("更新比分失败:", error);
                    // 即使获取标签失败，仍然尝试更新比分
                    const scorePayload = {
                        id: currentMatchForModal.id,
                        name: currentMatchForModal.name,
                        sport: currentMatchForModal.sport,
                        time_begin: currentMatchForModal.time_begin,
                        participants: payloadBase.participants,
                        is_finished: payloadBase.is_finished,
                        tag_ids: payloadBase.tag_ids // 使用表单中的tag_ids
                    };
                    console.log("Fallback - 使用默认标签更新赛事:", scorePayload);
                    res = await updateMatch(currentMatchForModal.id, scorePayload);
                }
            } else if (formModalMode === 'edit' && currentMatchForModal) {
                console.log(`Updating match ${currentMatchForModal.id} with payload:`, payloadBase);
                res = await updateMatch(currentMatchForModal.id, payloadBase);
            } else {
                throw new Error("无效的 Modal 模式或赛事数据");
            }

            if (res?.code === 0) {
                message.success('操作成功！');
                success = true;
                closeMatchFormModal();
                
                // 根据当前状态决定如何刷新数据
                if (isSearching) {
                    await performSearch();
                } else {
                    refreshCurrentList();
                }
            } else {
                message.error(res?.msg || '操作失败');
            }
        } catch (error) {
            console.error("表单提交错误:", error);
            message.error("网络错误，操作失败");
        } finally {
            setIsSubmittingForm(false);
        }
    }, [formModalMode, currentMatchForModal, closeMatchFormModal, refreshCurrentList, isSearching, performSearch]);

    // --- Match Deletion Handler --- (Keep existing handler)
    const handleDeleteMatch = useCallback(async (matchId) => {
        try {
            const res = await deleteMatch(matchId);
            if (res.code === 0) {
                message.success('删除成功');
                refreshCurrentList();
            } else {
                message.error(res.msg || '删除失败');
            }
        } catch (error) {
            message.error('网络错误，删除失败');
        }
    }, [refreshCurrentList]);

    // --- REMOVE the old Load More Button Component ---
    // const loadMoreButton = ... (DELETE THIS ENTIRE VARIABLE)

    // --- Render Component UI ---
    return (
        <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">

                {/* Page Header */}
                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Title level={3} style={{ margin: 0 }}>赛事列表</Title>
                        <Space>
                            {isUserLoggedIn && (
                                <Radio.Group 
                                    value={viewMode}
                                    onChange={e => switchViewMode(e.target.value)}
                                    buttonStyle="solid"
                                >
                                    <Radio.Button value="all">全部赛事</Radio.Button>
                                    <Radio.Button value="focus">我的关注</Radio.Button>
                                </Radio.Group>
                            )}
                            {canManageMatches && (
                                <Button type="primary" onClick={() => openMatchFormModal('create')}> 新建赛事 </Button>
                            )}
                        </Space>
                    </div>
                </Card>

                {/* 筛选部分 */}
                <FilterCard
                    selectedTags={selectedTags}
                    setSelectedTags={setSelectedTags}
                    searchText={searchText}
                    setSearchText={setSearchText}
                    performSearch={performSearch}
                    clearAllFilters={clearAllFilters}
                    searchLoading={searchLoading}
                    isSearching={isSearching}
                    searchResults={searchResults}
                />

                {/* Tabs for Filtering Matches */}
                <Card size="small" style={{ marginBottom: '-16px' }}>
                    <Tabs
                        activeKey={String(queryFinishedStatus)}
                        onChange={(key) => handleStatusChange(key === 'true')}
                        items={[
                            { key: 'false', label: '进行中 / 未开始' },
                            { key: 'true', label: '已结束' }
                        ]}
                    />
                </Card>

                {/* Filtered Matches Section */}
                {isSearching && (
                    <Card size="small" style={{ marginBottom: '1rem', backgroundColor: '#f6ffed' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Title level={4} style={{ margin: 0, color: '#389e0d' }}>
                                搜索结果
                            </Title>
                            <Button onClick={clearAllFilters} type="link" style={{ padding: 0 }}>
                                清除筛选条件
                            </Button>
                        </div>
                        <div style={{ marginTop: 8, color: '#555' }}>
                            {searchResults.length > 10 ? '10+' : searchResults.length} 个赛事符合以下条件：
                            <div style={{ marginTop: 4 }}>
                                • 赛事范围：{viewMode === 'focus' ? '我的关注' : '全部赛事'}
                            </div>
                            <div>
                                • 赛事状态：{queryFinishedStatus ? '已结束' : '进行中/未开始'}
                            </div>
                            {lastSearchText && <div>• 搜索关键词：{lastSearchText}</div>}
                            {lastSearchTags.length > 0 && (
                                <div>• 已选标签：{lastSearchTags.length}个</div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Main Content Area */}
                {(loading && !isSearching) ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
                ) : (!loading && matches.length === 0 && !isSearching) ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: 'grey' }}>
                        {viewMode === 'focus' 
                            ? (queryFinishedStatus ? '没有已关注且已结束的赛事' : '没有已关注且进行中或未开始的赛事')
                            : (queryFinishedStatus ? '没有已结束的赛事' : '没有进行中或未开始的赛事')
                        }
                    </div>
                ) : (
                    <> {/* Use Fragment to wrap List and Loader */}
                        <List
                            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                            dataSource={isSearching ? searchResults : matches}
                            // REMOVE loadMore prop: loadMore={loadMoreButton}
                            renderItem={(item) => (
                                <List.Item key={item.id}>
                                    <MatchCard
                                        item={item}
                                        canEdit={canUpdate(item.id)}
                                        canManage={canManageMatches}
                                        isOnlyScoreEditor={canUpdateSpecificMatch(item.id) && !canManageMatches}
                                        onEdit={() => openMatchFormModal('edit', item)}
                                        onGrantPermission={openGrantModal}
                                        onManageUpdaters={openManageModal}
                                        onDelete={handleDeleteMatch}
                                        isFocused={isMatchFocusedWithSearch(item.id)}
                                        onFocus={handleFocusMatchWithSearch}
                                        onUnfocus={handleUnfocusMatchWithSearch}
                                        isUserLoggedIn={isUserLoggedIn}
                                        searchText={lastSearchText}
                                        onUpdate={() => {
                                            // 根据当前状态决定刷新方式
                                            if (isSearching) {
                                                performSearch();
                                            } else {
                                                refreshCurrentList();
                                            }
                                        }}
                                    />
                                </List.Item>
                            )}
                        />
                        {/* --- Add Loader Element for Intersection Observer --- */}
                        {!isSearching && (
                            <div ref={loaderRef} style={{ textAlign: 'center', padding: 20, height: 50 }}>
                                {/* Show spinner only when loading more */}
                                {loadingMore && <Spin />}
                                {/* Show "no more" message when not loading more AND hasMore is false AND there were items */}
                                {!loadingMore && !hasMore && matches.length > 0 && (
                                    <Typography.Text type="secondary">没有更多赛事了</Typography.Text>
                                )}
                            </div>
                        )}
                        {/* --- Add Search Results Loader Element for Intersection Observer --- */}
                        {isSearching && (
                            <div ref={searchLoaderRef} style={{ textAlign: 'center', padding: 20, height: 50 }}>
                                {/* Show spinner only when loading more search results */}
                                {searchLoadingMore && <Spin />}
                                {/* Show "no more" message when not loading more AND searchHasMore is false AND there were search results */}
                                {!searchLoadingMore && !searchHasMore && searchResults.length > 0 && (
                                    <Typography.Text type="secondary">没有更多搜索结果了</Typography.Text>
                                )}
                            </div>
                        )}
                    </>
                )}
            </Space>

            {/* --- Modals --- (Keep existing modals) */}
            <MatchFormModal
                visible={isFormModalVisible}
                mode={formModalMode}
                initialData={currentMatchForModal}
                onSubmit={handleMatchFormSubmit}
                onCancel={closeMatchFormModal}
                submitting={isSubmittingForm}
            />
            <GrantPermissionModal
                visible={isGrantModalVisible}
                match={matchForGranting}
                onCancel={closeGrantModal}
                onGrantSuccess={(grantedUser) => {
                    console.log("Permission granted to:", grantedUser);
                    // Optional: Refresh manager list if open for the same match?
                    // if (isManageModalVisible && matchForManaging?.id === matchForGranting?.id) {
                    //    // Re-fetch logic for ManageUpdatersModal would be needed here
                    // }
                }}
            />
            <ManageUpdatersModal
                visible={isManageModalVisible}
                match={matchForManaging}
                onCancel={closeManageModal}
            />
        </div>
    );
};

export default MatchList;