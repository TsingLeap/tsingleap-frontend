import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Radio, InputNumber, Space, Alert, Typography, Button, message, Select, Tag } from 'antd';
import moment from 'moment';
import { getTagList, searchTagByPrefix, getTagListByCompetition } from '../../../services/api';
import TagSelector from '../../../components/TagSelector';

const { Text } = Typography;
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';

// 根据标签类型返回颜色
const getTagColor = (tagType) => {
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

const MatchFormModal = ({
  visible,
  mode,
  initialData,
  onSubmit,
  onCancel,
  submitting
}) => {
  const [form] = Form.useForm();
  const [tags, setTags] = useState([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchTagType, setSearchTagType] = useState('notype');

  const isScoreOnly = mode === 'edit_score_only';
  const isCreate = mode === 'create';

  // 独立的标签加载函数 - 用于加载所有赛事标签
  const fetchCompetitionTags = async (searchText = '') => {
    setTagLoading(true);
    try {
      const tagTypeParam = searchTagType === 'notype' ? '' : searchTagType;
      const selectedTagIds = form.getFieldValue('tag_ids') || [];
      console.log('当前已选标签IDs:', selectedTagIds);
      
      // 从API获取标签
      const res = await searchTagByPrefix(searchText, tagTypeParam);
      if (res.code === 0) {
        // 过滤出赛事标签
        const competitionTags = res.data.filter(tag => tag.is_competition_tag);
        
        // 检查是否有已选标签
        if (selectedTagIds.length > 0) {
          // 先保留搜索结果中的所有标签
          const result = [...competitionTags];
          
          // 如果是编辑模式且有selectedTagIds，从API获取这些标签的详细信息
          if ((mode === 'edit' || mode === 'edit_score_only') && initialData?.id) {
            try {
              const existingTagsRes = await getTagListByCompetition(initialData.id);
              if (existingTagsRes.code === 0 && existingTagsRes.data?.tag_list) {
                const existingTags = existingTagsRes.data.tag_list;
                
                // 找出已选但不在当前搜索结果中的标签
                existingTags.forEach(tag => {
                  if (selectedTagIds.includes(tag.id) && 
                      !result.some(t => t.id === tag.id)) {
                    result.push(tag);
                  }
                });
              }
            } catch (err) {
              console.error('获取已有标签失败:', err);
            }
          }
          
          // 确保当前已有标签中的已选标签也被包含
          tags.forEach(tag => {
            if (selectedTagIds.includes(tag.id) && 
                !result.some(t => t.id === tag.id)) {
              result.push(tag);
            }
          });
          
          // 对结果进行排序：将已选标签排在前面
          result.sort((a, b) => {
            const aSelected = selectedTagIds.includes(a.id);
            const bSelected = selectedTagIds.includes(b.id);
            
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0;
          });
          
          setTags(result);
        } else {
          // 如果没有已选标签，直接使用API返回的结果
          setTags(competitionTags);
        }
      } else {
        message.error(res.msg || '标签加载失败');
      }
    } catch (error) {
      message.error('网络错误，无法加载标签');
      console.error('加载标签失败:', error);
    } finally {
      setTagLoading(false);
    }
  };

  // 当编辑模式打开时，加载现有的标签
  useEffect(() => {
    if (visible && initialData?.id && (mode === 'edit' || mode === 'edit_score_only')) {
      const loadExistingTags = async () => {
        try {
          // 获取该赛事的现有标签
          const res = await getTagListByCompetition(initialData.id);
          if (res.code === 0 && res.data?.tag_list) {
            const existingTags = res.data.tag_list;
            const tagIds = existingTags.map(tag => tag.id);
            
            console.log('加载赛事现有标签:', existingTags);

            // 更新form中的tag_ids字段
            form.setFieldsValue({ tag_ids: tagIds });

            // 确保这些标签在选择器中可见
            setTags(prevTags => {
              // 合并现有标签和搜索结果中的标签，避免重复
              const mergedTags = [...prevTags];
              existingTags.forEach(tag => {
                if (!mergedTags.some(t => t.id === tag.id)) {
                  mergedTags.push(tag);
                }
              });
              return mergedTags;
            });
          }
        } catch (error) {
          console.error('获取赛事标签失败:', error);
          message.error('加载赛事现有标签失败');
        }
      };
      loadExistingTags();
    }
  }, [visible, initialData?.id, mode, form]);

  // 初始化表单数据
  useEffect(() => {
    if (visible && initialData && (mode === 'edit' || mode === 'edit_score_only')) {
      const formValues = {
        ...initialData,
        time_begin_str: initialData.time_begin ? moment(initialData.time_begin).format(DATETIME_FORMAT) : '',
        is_finished: initialData.is_finished,
        tag_ids: initialData.tag_ids || []
      };
      console.log('初始化表单数据:', formValues);
      form.setFieldsValue(formValues);
      
      // 不在这里调用 fetchCompetitionTags，
      // 因为我们在打开对话框时会调用它
    } else if (visible && isCreate) {
      form.resetFields();
      form.setFieldsValue({
        is_finished: false,
        time_begin_str: '',
        participants: [{ name: '', score: 0 }, { name: '', score: 0 }],
        tag_ids: []
      });
      
      // 同上，不在这里调用 fetchCompetitionTags
    } else if (!visible) {
      form.resetFields();
    }
  }, [visible, initialData, mode, form, isCreate]);

  // 当对话框可见时，加载所有标签
  useEffect(() => {
    if (visible) {
      fetchCompetitionTags();
    }
  }, [visible]);  // 仅在对话框显示状态变化时触发

  // 自定义日期时间格式验证器
  const validateDateTimeFormat = (_, value) => {
    if (!value) {
      return Promise.resolve();
    }
    if (moment(value, DATETIME_FORMAT, true).isValid()) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(`请输入有效的日期时间，格式为 ${DATETIME_FORMAT}`));
  };

  // 处理表单提交
  const handleOk = () => {
    form.validateFields()
      .then(values => {
        // 确保tag_ids是有效的数组
        const formValues = { ...values };
        if (!Array.isArray(formValues.tag_ids)) {
          formValues.tag_ids = formValues.tag_ids ? [formValues.tag_ids] : [];
        }
        
        console.log('提交表单数据:', formValues);
        onSubmit(formValues);
      })
      .catch(info => {
        console.log('表单验证失败:', info);
      });
  };

  // 处理标签搜索
  const handleSearchTags = async (value) => {
    setSearchValue(value);
    fetchCompetitionTags(value);
  };

  // 处理标签值变化
  const handleTagsChange = (value) => {
    console.log('标签选择变化:', value);
    form.setFieldsValue({ tag_ids: value });
    // 变化后确保所有已选标签在列表中可见
    fetchCompetitionTags(searchValue);
  };

  const modalTitle = isCreate ? '创建新赛事' :
    mode === 'edit' ? `编辑赛事: ${initialData?.name ?? ''}` :
    `更新比分/状态: ${initialData?.name ?? ''}`;

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okText={isCreate ? '创建' : '保存'}
      cancelText="取消"
      destroyOnClose
      maskClosable={!submitting}
      width={600}
    >
      {isScoreOnly && (
        <Alert message="您仅可修改比分和赛事结束状态。" type="info" showIcon style={{ marginBottom: 16 }}/>
      )}

      <Form
        form={form}
        layout="vertical"
        name="matchForm"
        initialValues={{
          ...initialData,
          time_begin: initialData?.time_begin ? moment(initialData.time_begin).format(DATETIME_FORMAT) : undefined,
        }}
      >
        <Form.Item name="name" label="赛事名称" rules={[{ required: true, message: '请输入赛事名称' }]}>
          <Input disabled={isScoreOnly} placeholder={isScoreOnly ? initialData?.name : '例如：男子篮球决赛'}/>
        </Form.Item>
        
        <Form.Item name="sport" label="赛事项目" rules={[{ required: true, message: '请输入赛事项目' }]}>
          <Input disabled={isScoreOnly} placeholder={isScoreOnly ? initialData?.sport : '例如：篮球'}/>
        </Form.Item>

        <Form.Item label="参赛方" required tooltip="添加参赛队伍及其得分">
          <Form.List
            name="participants"
            initialValue={[{ name: '', score: 0 }, { name: '', score: 0 }]}
            rules={[
              {
                validator: async (_, participants) => {
                  if (!participants || participants.length < 1) {
                    return Promise.reject(new Error('至少需要添加一个参赛方'));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field, index) => (
                  <Space key={field.key} align="baseline" style={{ marginBottom: 8, display: 'flex' }}>
                    <Form.Item
                      {...field}
                      name={[field.name, 'name']}
                      rules={[{ required: true, message: '请输入参赛方名称' }]}
                      style={{ width: '200px', marginBottom: 0 }}
                    >
                      <Input 
                        disabled={isScoreOnly} 
                        placeholder={`参赛方${index + 1}名称`} 
                      />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'score']}
                      rules={[
                        { required: true, message: '请输入得分' },
                        { type: 'number', min: 0, message: '分数不能为负' }
                      ]}
                      style={{ width: '100px', marginBottom: 0 }}
                    >
                      <InputNumber min={0} placeholder="得分" style={{ width: '100%' }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button 
                        onClick={() => remove(field.name)} 
                        disabled={isScoreOnly}
                        danger
                      >
                        删除
                      </Button>
                    )}
                  </Space>
                ))}
                <Form.Item>
                  <Button 
                    type="dashed" 
                    onClick={() => add({ name: '', score: 0 })} 
                    disabled={isScoreOnly}
                    block
                  >
                    + 添加参赛方
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item
          name="time_begin_str"
          label="开赛时间"
          rules={[
            { required: true, message: '请输入开赛时间' },
            { validator: validateDateTimeFormat }
          ]}
          tooltip={`请输入格式为 ${DATETIME_FORMAT} 的日期和时间`}
        >
          <Input
            disabled={isScoreOnly}
            placeholder={DATETIME_FORMAT}
            maxLength={16}
          />
        </Form.Item>

        <Form.Item
          name="is_finished"
          label="赛事状态"
          rules={[{ required: true, message: '请选择赛事状态' }]}
        >
          <Radio.Group optionType="button" buttonStyle="solid">
            <Radio.Button value={false}>进行中/未开始</Radio.Button>
            <Radio.Button value={true}>已结束</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {!isScoreOnly && (
          <Form.Item
            name="tag_ids"
            label="标签"
            tooltip="为赛事添加标签，最多可选5个标签"
            rules={[
              { 
                validator: (_, value) => {
                  if (value && value.length > 5) {
                    return Promise.reject('最多只能选择5个标签');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <TagSelector
              onlyCompetitionTags={true}
              maxSelectCount={5}
              placeholder="选择赛事标签（最多5个）"
            />
          </Form.Item>
        )}

      </Form>
    </Modal>
  );
};

export default MatchFormModal;