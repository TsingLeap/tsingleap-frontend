import { message } from 'antd';
import axios from 'axios';
import { getUser } from '../utils/auth';
import qs from 'qs';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// 获取 Cookie 的工具函数
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

// 获取 CSRF Token 
const getCsrfToken = async () => {
  await api.get('/get_csrf_token/');
  await new Promise((resolve) => setTimeout(resolve, 100));
};

// 封装带 CSRF 头的 POST 请求
const csrfPost = async (url, data) => {
  await getCsrfToken();

  console.log('[当前 document.cookie]', document.cookie);

  const token = getCookie('csrftoken');

  console.log('[Cookie 中的 csrftoken]', token);
  console.log('[请求头中的 X-CSRFToken]', token); 
  return api.post(url, data, {
    headers: {
      'X-CSRFToken': token,
    },
  });
};

// 登录接口
export const login = async (username, password) => {
  const response = await csrfPost('/login/', { username, password });
  return response.data;
};

// 注册接口
export const register = async (userData) => {
  const response = await csrfPost('/register/', userData);
  return response.data;
};

// 发送验证码接口
export const sendVerificationCode = async (email) => {
  const response = await csrfPost('/send_verification_code/', { email });
  return response.data;
};

// 获取用户信息
export const getUserInfo = async (username) => {
  const res = await api.get('/settings/get_user_info/', {
    params: {username},
  });
  return res.data;
};

// 修改昵称
export const changeNickname = async (username, nickname) => {
  const res = await csrfPost('/settings/change_nickname/', { username, nickname });
  return res.data;
};

// 获得用户权限信息
export const getUserPermissionInfo = async (username) => {
  const res = await api.get('/settings/get_user_permission_info/', {
    params: { username },
  });
  return res.data;
};

// 添加用户权限
export const userAddPermission = async ({ operator, username, permission_name, permission_info }) => {
  const res = await csrfPost('/settings/user_add_permission/', {
    operator,
    username,
    permission_name,
    permission_info,
  });
  return res.data;
};

// 移除用户权限
export const userRemovePermission = async ({ operator, username, permission_name, permission_info }) => {
  const res = await csrfPost('/settings/user_remove_permission/', {
    operator,
    username,
    permission_name,
    permission_info,
  });
  return res.data;
};

// 修改密码
export const changePassword = async ({ username, password, new_password }) => {
  const res = await csrfPost('/settings/change_password/', {
    username,
    password,
    new_password,
  });
  return res.data;
};

// 用户名前缀搜索
export const searchUsernamePrefix = async (prefix) => {
  const res = await api.get('/settings/search_username_settings/', {
    params: { username_prefix: prefix },
  });
  return res.data;
};

// 发表帖子
export const createForumPost = async ({ username, title, content }) => {
  const res = await csrfPost('/forum/create_post/', { username, title, content });
  return res.data;
};

// 创建赛事
export const createMatch = async (competitionData) => {
  const CREATE_URL = '/competitions/create_competition/'; 
  try {
    // 移除participants字段，因为新API不再支持创建时直接添加参赛者
    const { participants, ...dataWithoutParticipants } = competitionData;
    const response = await csrfPost(CREATE_URL, dataWithoutParticipants);
    
    // 如果创建成功并且有participants数据，则批量添加参赛者
    if (response.data.code === 0 && participants && participants.length > 0) {
      const competitionId = response.data.data.id;
      await addParticipant(competitionId, participants);
    }
    
    return response.data; 
  } catch (error) {
    console.error(`Error creating competition at ${CREATE_URL}:`, error);
    return { code: error.response?.status || 500, msg: error.response?.data?.msg || '创建赛事失败', data: null };
  }
};

// 更新赛事
export const updateMatch = async (competitionId, competitionData) => {
  const UPDATE_URL = '/competitions/update_competition/'; 
  try {
    // 分离参赛者数据
    const { participants, ...baseData } = competitionData;
    
    // 构建更新请求
    const payload = {
      id: competitionId,
      ...baseData
    };
    
    // 首先更新比赛基本信息
    const response = await csrfPost(UPDATE_URL, payload);
    
    // 如果更新成功且有参赛者数据，更新参赛者信息
    if (response.data.code === 0 && participants) {
      // 获取当前参赛者列表
      const currentParticipantsRes = await getParticipantList(competitionId);
      
      if (currentParticipantsRes.code === 0) {
        const currentParticipants = currentParticipantsRes.data.participant_list;
        
        // 找出需要删除的参赛者ID
        const participantsToDelete = currentParticipants.filter(current => 
          !participants.some(p => 
            (p.id && p.id === current.id) || 
            (p.name === current.name)
          )
        ).map(p => p.id);

        // 找出需要添加的新参赛者
        const participantsToAdd = participants.filter(p => 
          !currentParticipants.some(current => 
            (p.id && p.id === current.id) || 
            (p.name === current.name)
          )
        );

        // 找出需要更新的参赛者
        const participantsToUpdate = participants.filter(p => 
          currentParticipants.some(current => 
            ((p.id && p.id === current.id) || (p.name === current.name)) &&
            current.score !== p.score
          )
        ).map(p => {
          const current = currentParticipants.find(c => 
            (p.id && p.id === c.id) || (p.name === c.name)
          );
          return {
            id: current.id,
            name: p.name,
            score: p.score
          };
        });

        // 批量删除不再需要的参赛者
        if (participantsToDelete.length > 0) {
          await deleteParticipant(participantsToDelete);
        }

        // 批量添加新参赛者
        if (participantsToAdd.length > 0) {
          await addParticipant(competitionId, participantsToAdd);
        }

        // 批量更新现有参赛者
        if (participantsToUpdate.length > 0) {
          await updateParticipant(participantsToUpdate);
        }
      }
    }
    
    return response.data; 
  } catch (error) {
    console.error(`Error updating competition at ${UPDATE_URL}:`, error);
    return { code: error.response?.status || 500, msg: error.response?.data?.msg || '更新赛事失败', data: null };
  }
};

// 删除赛事
export const deleteMatch = async (competitionId) => {
  const DELETE_URL = '/competitions/delete_competition/'; // Correct Path
  try {
    const payload = { id: competitionId };
    const response = await csrfPost(DELETE_URL, payload);
     if (response.data && response.data.code === 0) {
       return { code: 0, msg: '删除成功' };
     } else {
       return { code: response.data?.code ?? response.status, msg: response.data?.msg || '删除失败', data: response.data };
     }
  } catch (error) {
    console.error(`Error deleting competition at ${DELETE_URL}:`, error);
    return { code: error.response?.status || 500, msg: error.response?.data?.msg || '删除赛事失败', data: null };
  }
};

// 获取赛事
export const getMatches = async (cursors = { before_time: "", before_id: -1 }, isFinished, userId = -1, tagList = [], searchText = "", filterFocus = false) => {
  const LIST_URL = '/competitions/get_competition_list/';
  try {
    const payload = {
      before_time: cursors.before_time, 
      before_id: cursors.before_id,     
      is_finished: Boolean(isFinished),
      user_id: userId,
      tag_list: Array.isArray(tagList) ? tagList : [],
      search_text: searchText || "",
      filter_focus: Boolean(filterFocus)
    };

    console.log("Fetching matches with payload:", JSON.stringify(payload));

    const response = await csrfPost(LIST_URL, payload);
    
    // 如果获取比赛列表成功，为每个比赛获取参赛者列表
    if (response.data.code === 0 && response.data.data?.competition_list) {
      const competitions = response.data.data.competition_list;
      
      // 并行获取所有比赛的参赛者列表
      await Promise.all(competitions.map(async (competition) => {
        try {
          const participantResponse = await getParticipantList(competition.id);
          if (participantResponse.code === 0) {
            competition.participants = participantResponse.data.participant_list;
          } else {
            console.warn(`Failed to get participant list for competition ${competition.id}:`, participantResponse);
            competition.participants = [];
          }
        } catch (error) {
          console.error(`Error fetching participants for competition ${competition.id}:`, error);
          competition.participants = [];
        }
      }));
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching competition list from ${LIST_URL} with payload:`, payload, error);
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    return {
      code: errorData?.code ?? statusCode ?? -1,
      msg: errorData?.msg ?? `获取赛事列表失败 (${statusCode || 'Network Error'})`,
      data: null
    };
  }
};

// 比分更新 - 重定向到updateMatch
export const updateMatchScore = async (matchId, scoreData) => {
  // 获取比赛信息
  try {
    // 获取当前比赛信息，以便在只更新比分时保留其他信息
    const currentUser = getUser();
    const userId = currentUser?.id || -1;
    const matchInfoResponse = await getCompetitionInfo(matchId, userId);
    if (matchInfoResponse.code !== 0) {
      return { code: matchInfoResponse.code, msg: '获取赛事信息失败', data: null };
    }
    
    const currentMatch = matchInfoResponse.data.competition;
    
    // 准备更新数据
    const payload = {
      id: matchId,
      // 保留原有基本数据
      name: currentMatch.name,
      sport: currentMatch.sport,
      time_begin: currentMatch.time_begin,
      is_finished: Boolean(scoreData.is_finished)
    };
    
    // 首先更新比赛基本信息
    const updateResponse = await csrfPost('/competitions/update_competition/', payload);
    
    if (updateResponse.data.code !== 0) {
      return updateResponse.data;
    }
    
    // 更新参赛者分数
    let currentParticipants = currentMatch.participants || [];
    
    // 如果有直接传入participants结构，则使用该结构
    if (scoreData.participants) {
      const participantsToUpdate = scoreData.participants.map(newParticipant => {
        const existingParticipant = currentParticipants.find(p => 
          (p.id && p.id === newParticipant.id) || 
          (p.name === newParticipant.name)
        );
        
        if (existingParticipant && existingParticipant.score !== newParticipant.score) {
          return {
            id: existingParticipant.id,
            name: existingParticipant.name,
            score: newParticipant.score
          };
        }
        return null;
      }).filter(Boolean);

      if (participantsToUpdate.length > 0) {
        await updateParticipant(participantsToUpdate);
      }
    } else if (scoreData.score_a !== undefined && scoreData.score_b !== undefined) {
      // 向后兼容：处理旧的score_a和score_b格式
      if (currentParticipants.length >= 2) {
        const participantsToUpdate = [];
        
        // 更新第一个参赛者
        if (currentParticipants[0].score !== Number(scoreData.score_a)) {
          participantsToUpdate.push({
            id: currentParticipants[0].id,
            name: currentParticipants[0].name,
            score: Number(scoreData.score_a)
          });
        }
        
        // 更新第二个参赛者
        if (currentParticipants[1].score !== Number(scoreData.score_b)) {
          participantsToUpdate.push({
            id: currentParticipants[1].id,
            name: currentParticipants[1].name,
            score: Number(scoreData.score_b)
          });
        }

        if (participantsToUpdate.length > 0) {
          await updateParticipant(participantsToUpdate);
        }
      }
    }
    
    return { code: 0, msg: '更新成功', data: null };
  } catch (error) {
    console.error(`Error updating match score:`, error);
    return { code: error.response?.status || 500, msg: error.response?.data?.msg || '更新赛事比分失败', data: null };
  }
};

// 更新赛事管理者
export const getMatchAdminList = async (matchId) => {
  const GET_ADMIN_LIST_URL = '/competitions/get_competition_admin_list/';
  try {
    const res = await api.get(GET_ADMIN_LIST_URL, {
      params: {
        id: matchId,
      },
    });

    if (res.data && res.data.code === 0 && Array.isArray(res.data.data?.admin_list)) {
      console.log("API returned admin_list objects:", res.data.data.admin_list);

      return {
        ...res.data,
        data: {
          users: res.data.data.admin_list.map(admin => ({
            username: admin.username,
            nickname: admin.nickname || admin.username 
          }))
        }
      };
    } else {
      console.warn('getMatchAdminList response format not as expected or code != 0:', res.data);
      return { code: res.data?.code ?? 1, msg: res.data?.msg || '获取管理员列表失败', data: { users: [] } };
    }
  } catch (error) {
    console.error(`Error fetching match admin list from ${GET_ADMIN_LIST_URL}:`, error);
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    return { code: errorData?.code ?? statusCode ?? -1, msg: errorData?.msg || '网络错误，获取管理员列表失败', data: { users: [] } };
  }
};

export const getCompetitionInfo = async (competitionId, userId = -1) => {
  const INFO_URL = '/competitions/get_competition_info/';
  try {
      const response = await api.get(INFO_URL, {
          params: { id: competitionId }
      });
      
      // 如果获取比赛信息成功，再获取参赛者列表
      if (response.data.code === 0) {
          const participantResponse = await getParticipantList(competitionId, userId);
          
          if (participantResponse.code === 0) {
              // 将参赛者信息添加到比赛信息中，保持与旧API兼容
              response.data.data.competition.participants = participantResponse.data.participant_list;
          } else {
              console.warn('Failed to get participant list:', participantResponse);
              // 如果获取参赛者列表失败，设置为空数组
              response.data.data.competition.participants = [];
          }
      }
      
      // Returns { code: 0, msg: "...", data: { competition: {...} } } on success
      // Returns { code: 1101, msg: "比赛不存在", data: null } if not found
      return response.data;
  } catch (error) {
      console.error(`Error fetching competition info for ID ${competitionId} from ${INFO_URL}:`, error);
      const errorData = error.response?.data;
      const statusCode = error.response?.status;
      return {
          code: errorData?.code ?? statusCode ?? -1,
          msg: errorData?.msg ?? `获取赛事详情失败 (${statusCode || 'Network Error'})`,
          data: null
      };
  }
};

// 获取帖子详细
export const getPostDetail = async (post_id) => {
  const res = await api.get('/forum/post_detail/', {
    params: {post_id} ,
  });
  return res.data;
};

// 获取帖子评论
export const getComments = async (contentType, objectId, page, pageSize) => {
  const res = await api.get('/forum/comments_of_object/', {
    params: {
      content_type: contentType,
      object_id: objectId,
      page,
      page_size: pageSize
    },
  });
  return res.data;
};

// 创建评论
export const createComment = async ({username, contentType, objectId, content, allowReply = true}) => {
  const res = await csrfPost('/forum/create_comment_of_object/', {
    username,
    content_type: contentType,
    object_id: objectId,
    content,
    allow_reply: allowReply,
  });
  return res.data;
};

// 获取回复
export const getReplies = async(comment_id) => {
  const res = await api.get('/forum/get_reply_list_of_comment/', {
    params: { comment_id: comment_id },
  });
  return res.data
}
 
// 删除帖子
export const deletePost = async ({username, post_id}) => {
  const res = await csrfPost('/forum/delete_post/', {
    username,
    post_id,
  });
  return res.data;
};

// 添加比赛关注
export const addCompetitionFocus = async (competitionId, userId) => {
  const FOCUS_URL = '/competitions/add_competition_focus/';
  try {
    const payload = {
      competition_id: competitionId,
      user_id: userId
    };
    const response = await csrfPost(FOCUS_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error adding competition focus at ${FOCUS_URL}:`, error);
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    return {
      code: errorData?.code ?? statusCode ?? -1,
      msg: errorData?.msg ?? `关注赛事失败 (${statusCode || 'Network Error'})`,
      data: null
    };
  }
};

// 取消比赛关注
export const delCompetitionFocus = async (competitionId, userId) => {
  const DEL_FOCUS_URL = '/competitions/del_competition_focus/';
  try {
    const payload = {
      competition_id: competitionId,
      user_id: userId
    };
    const response = await csrfPost(DEL_FOCUS_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error deleting competition focus at ${DEL_FOCUS_URL}:`, error);
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    return {
      code: errorData?.code ?? statusCode ?? -1,
      msg: errorData?.msg ?? `取消关注赛事失败 (${statusCode || 'Network Error'})`,
      data: null
    };
  }
};

// 获取用户关注的比赛列表
export const getFocusCompetitionList = async (userId, cursors = { before_time: "", before_id: -1 }, isFinished) => {
  try {
    // 通过新的getMatches函数，设置filterFocus=true来获取关注列表
    const response = await getMatches(cursors, isFinished, userId, [], "", true);
    return response;
  } catch (error) {
    console.error(`Error fetching focus competition list:`, error);
    const errorData = error.response?.data;
    const statusCode = error.response?.status;
    return {
      code: errorData?.code ?? statusCode ?? -1,
      msg: errorData?.msg ?? `获取关注赛事列表失败 (${statusCode || 'Network Error'})`,
      data: { competition_list: [] } // 确保即使出错时也有一个空的 competition_list
    };
  }
};

// 创建tag
export const createTag = async ({username, tag_name, tag_type, is_post_tag, is_competition_tag}) => {
  const res = await csrfPost('/tag/create_tag/', {
    username:username,
    name:tag_name,
    tag_type:tag_type,
    is_post_tag:is_post_tag,
    is_competition_tag:is_competition_tag,
  });
  return res.data;
};

// 删除tag
export const deleteTag = async ({username, tag_id}) => {
  const res = await csrfPost('/tag/delete_tag/', {
    username,
    tag_id,
  });
  return res.data;
};

// 获取tag列表
export const getTagList = async () => {
  const res = await api.get('/tag/get_tag_list/');
  return res.data;
};

// 根据前缀搜索tag
export const searchTagByPrefix = async (prefix, tag_type) => {
  const res = await api.get('/tag/search_tag_by_prefix/', {
    params: {prefix, tag_type},
  });
  return res.data;
};

// 获取帖子列表
export const getForumPosts = async (tag_list = [], keyword = '', page, page_size) => {
  const res = await api.get('/forum/posts/', {
    params: {
      tag_list,
      keyword,
      page,
      page_size,
    },
    paramsSerializer: params => qs.stringify(params, { arrayFormat: 'repeat' }), // 👈
  });
  return res.data;
};
// 根据tag得到post列表
export const getPostListByTag = async (tag_id, page, page_size) => {
  const res = await api.get('/tag/get_post_list_by_tag/', {
    params:{
      tag_id,
      page,
      page_size
    },
  });
  return res.data;
};


// 创建带tag的帖子
export const createPostWithTag = async ({username, title, content, tag_ids}) => {
  const res = await csrfPost('/forum/create_post_with_tag/', {
    username,
    title,
    content,
    tag_ids
  });
  return res.data;
};

// 获取指定帖子的tag列表
export const getTagListByPostId = async (post_id) => {
  const res = await api.get('/forum/get_tag_list_by_post_id/', {
    params: { post_id },
  });
  return res.data;
};

// 为帖子添加tag
export const addTagToPost = async ({username, post_id, tag_ids}) => {
  const res = await csrfPost('/forum/add_tag_to_post/', {
    username,
    post_id,
    tag_ids
  });
  return res.data;
};

// 根据标签过滤赛事
export const getCompetitionListByTag = async (user_id, tag_list, before_time, before_id, is_finished) => {
  try {
    // 通过新的getMatches函数，传入tag_list来过滤赛事
    const cursors = { before_time, before_id };
    const response = await getMatches(cursors, is_finished, user_id, tag_list);
    return response;
  } catch (error) {
    console.error('获取按标签过滤的赛事列表失败:', error);
    return { code: -1, msg: '网络错误', data: null };
  }
};

// 获取赛事的标签列表
export const getTagListByCompetition = async (competition_id) => {
  try {
    const res = await api.get('/competitions/get_tag_list_by_competition/', {
      params: { competition_id }
    });
    return res.data;
  } catch (error) {
    console.error('获取赛事标签列表失败:', error);
    return { code: -1, msg: '网络错误', data: null };
  }
};

// 删除帖子中的tag
export const removeTagFromPost = async ({username, post_id, tag_ids}) => {
  const res = await csrfPost('/forum/remove_tag_from_post/', {
    username,
    post_id,
    tag_ids
  });
  return res.data;
};

// 删除指定评论
export const deleteComment = async ({username, comment_id}) => {
  const res = await csrfPost('/forum/delete_comment/', {
    username,
    comment_id,
  });
  return res.data;
};

// 创建一条举报
export const createReport = async (reporter, content_type, object_id, reason) => {
  const res = await csrfPost('/forum/create_report/', {
    reporter,
    content_type,
    object_id,
    reason,
  });
  return res.data;
};


// 获取举报列表
export const getReportList = async ({solved_state, page, page_size}) => {
  const res = await api.get('/forum/get_report_list/',{
    params: {
      solved_state,
      page,
      page_size
    }
  });
  return res.data;
};

// 修改举报状态
export const modifyReportSolvedState = async (username, report_id, solved_state) => {
  const res = await csrfPost('/forum/modify_report_solved_state/',{
    username,
    report_id,
    solved_state,
  });
  return res.data;
};

// 删除举报对象
export const deleteReportedObject = async (username, report_id) => {
  const res = await csrfPost('./forum/delete_reported_object/',{
    username,
    report_id,
  });
  return res.data;
};

// 封禁被举报者
export const banReportedUser = async (username, report_id) => {
  const res = await csrfPost('./forum/ban_reported_user/', {
    username,
    report_id,
  });
  return res.data;
};

// 获取指定帖子的详细信息
export const getCommentDetail = async (comment_id) => {
  const res = await api.get('/forum/get_comment_detail_by_id/',{
    params: {comment_id},
  });
  return res.data;
}


// 添加参赛者
export const addParticipant = async (competitionId, participants) => {
  const ADD_PARTICIPANT_URL = '/competitions/add_participant/';
  try {
    const payload = {
      competition_id: competitionId,
      participants: participants
    };
    const response = await csrfPost(ADD_PARTICIPANT_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error adding participant at ${ADD_PARTICIPANT_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '添加参赛者失败', 
      data: null 
    };
  }
};

// 删除参赛者
export const deleteParticipant = async (participantIds) => {
  const DELETE_PARTICIPANT_URL = '/competitions/delete_participant/';
  try {
    const payload = {
      participant_ids: Array.isArray(participantIds) ? participantIds : [participantIds]
    };
    const response = await csrfPost(DELETE_PARTICIPANT_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error deleting participant at ${DELETE_PARTICIPANT_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '删除参赛者失败', 
      data: null 
    };
  }
};

// 获取参赛者列表
export const getParticipantList = async (competitionId, userId = -1) => {
  const GET_PARTICIPANT_LIST_URL = '/competitions/get_participant_list/';
  try {
    const response = await api.get(GET_PARTICIPANT_LIST_URL, {
      params: { 
        competition_id: competitionId,
        user_id: userId 
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error getting participant list at ${GET_PARTICIPANT_LIST_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '获取参赛者列表失败', 
      data: { participant_list: [] } 
    };
  }
};

// 点赞参赛者
export const likeParticipant = async (userId, participantId) => {
  const LIKE_PARTICIPANT_URL = '/competitions/like_participant/';
  try {
    const payload = {
      user_id: userId,
      participant_id: participantId
    };
    const response = await csrfPost(LIKE_PARTICIPANT_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error liking participant at ${LIKE_PARTICIPANT_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '点赞参赛者失败', 
      data: null 
    };
  }
};

// 取消点赞参赛者
export const unlikeParticipant = async (userId, participantId) => {
  const UNLIKE_PARTICIPANT_URL = '/competitions/unlike_participant/';
  try {
    const payload = {
      user_id: userId,
      participant_id: participantId
    };
    const response = await csrfPost(UNLIKE_PARTICIPANT_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error unliking participant at ${UNLIKE_PARTICIPANT_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '取消点赞参赛者失败', 
      data: null 
    };
  }
};

// 获取参赛者点赞数和点赞状态
export const getLikeCount = async (participantId, userId) => {
  const GET_LIKE_COUNT_URL = '/competitions/get_like_count/';
  try {
    const response = await api.get(GET_LIKE_COUNT_URL, {
      params: { 
        participant_id: participantId,
        user_id: userId
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error getting participant like count at ${GET_LIKE_COUNT_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '获取参赛者点赞数失败', 
      data: { like_count: 0, is_like: false } 
    };
  }
};

// 更新参赛者信息
export const updateParticipant = async (participants) => {
  const UPDATE_PARTICIPANT_URL = '/competitions/update_participant/';
  try {
    const payload = {
      participants: participants
    };
    const response = await csrfPost(UPDATE_PARTICIPANT_URL, payload);
    return response.data;
  } catch (error) {
    console.error(`Error updating participant at ${UPDATE_PARTICIPANT_URL}:`, error);
    return { 
      code: error.response?.status || 500, 
      msg: error.response?.data?.msg || '更新参赛者失败', 
      data: null 
    };
  }
};



