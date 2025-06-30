import React, { useState, useEffect, useRef } from 'react';
import { Select, Tag, Space } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { searchTagByPrefix } from '../services/api';

// 统一的标签颜色映射
export const getTagColor = (tagType) => {
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

const TagSelector = ({
  value,
  onChange,
  mode = 'multiple',
  placeholder = '选择或搜索标签',
  maxTagCount = 'responsive',
  style = {},
  showTypeSelector = true,
  onlyCompetitionTags = false,
  onlyPostTags = false,
  maxSelectCount,
}) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('notype');
  const [searchText, setSearchText] = useState('');

  const currentFetchId = useRef(0); // 添加请求标识

  // 加载标签
  const fetchTags = async (prefix = '') => {
    const fetchId = ++currentFetchId.current;
    setLoading(true);
    try {
      const tagTypeParam = searchType === 'notype' ? '' : searchType;
      const res = await searchTagByPrefix(prefix, tagTypeParam);
      if (res.code === 0 && fetchId === currentFetchId.current) {
        let filteredTags = res.data;
        if (onlyCompetitionTags) {
          filteredTags = filteredTags.filter(tag => tag.is_competition_tag);
        }
        if (onlyPostTags) {
          filteredTags = filteredTags.filter(tag => tag.is_post_tag);
        }
        setTags(filteredTags);
      }
    } catch (error) {
      if (fetchId === currentFetchId.current) {
        console.error('加载标签失败:', error);
      }
    } finally {
      if (fetchId === currentFetchId.current) {
        setLoading(false);
      }
    }
  };

  // 初始加载和类型变化时重新加载标签
  useEffect(() => {
    fetchTags(searchText);
  }, [searchType]);

  // 处理标签搜索
  const handleSearch = (text) => {
    setSearchText(text);
    fetchTags(text);
  };

  // 处理标签选择变化
  const handleChange = (newValue) => {
    if (maxSelectCount && newValue.length > maxSelectCount) {
      return;
    }
    onChange?.(newValue);
    setSearchText('');
    fetchTags('');
  };

  return (
    <Space.Compact style={{ width: '100%', ...style }}>
      {showTypeSelector && (
        <Select
          style={{ width: 120 }}
          value={searchType}
          onChange={setSearchType}
          options={[
            { label: '全部类型', value: 'notype' },
            { label: '运动', value: 'sports' },
            { label: '院系', value: 'department' },
            { label: '精华帖', value: 'highlight' },
            { label: '赛事', value: 'event' },
            { label: '默认', value: 'default' },
          ]}
        />
      )}
      <Select
        mode={mode}
        style={{ flex: 1, minHeight: 32 }}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxTagCount="responsive"
        loading={loading}
        showSearch
        searchValue={searchText}
        onSearch={handleSearch}
        filterOption={false}
        notFoundContent={loading ? '正在加载...' : '无匹配标签'}
        optionLabelProp="label"
        suffixIcon={<TagOutlined />}
        tagRender={(props) => {
          const tag = tags.find(t => t.id === props.value) ||
            { name: props.label, tag_type: 'default' };
          return (
            <Tag
              closable={props.closable}
              onClose={props.onClose}
              style={{ marginRight: 3 }}
              color={getTagColor(tag.tag_type)}
            >
              {tag.name}
            </Tag>
          );
        }}
      >
        {tags.map(tag => (
          <Select.Option
            key={tag.id}
            value={tag.id}
            label={tag.name}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{tag.name}</span>
              <Tag color={getTagColor(tag.tag_type)} style={{ marginRight: 0 }}>
                {tag.tag_type}
              </Tag>
            </div>
          </Select.Option>
        ))}
      </Select>
    </Space.Compact>
  );
};

export default TagSelector;