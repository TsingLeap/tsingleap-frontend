import React from 'react';
import PropTypes from 'prop-types';

/**
 * 高亮文本组件，用于高亮显示文本中的关键词
 * @param {Object} props
 * @param {string} props.text 原始文本
 * @param {string} props.highlight 需要高亮的关键词
 * @param {Object} props.highlightStyle 高亮样式
 * @returns {React.ReactNode}
 */
const HighlightText = ({ text, highlight, highlightStyle = {} }) => {
  // 如果没有高亮关键词或文本为空，直接返回原始文本
  if (!highlight || !text) {
    return <span>{text}</span>;
  }

  // 默认高亮样式
  const defaultStyle = {
    backgroundColor: '#ffe58f',
    padding: '0 2px',
    borderRadius: '2px',
    fontWeight: 'bold',
  };

  // 合并默认样式和自定义样式
  const style = { ...defaultStyle, ...highlightStyle };

  // 不区分大小写的关键词匹配
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  // 分割文本
  const parts = text.split(regex);

  // 渲染高亮部分和普通部分
  return (
    <span>
      {parts.map((part, index) => {
        return regex.test(part) ? (
          <span key={index} style={style}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
};

HighlightText.propTypes = {
  text: PropTypes.string.isRequired,
  highlight: PropTypes.string,
  highlightStyle: PropTypes.object,
};

export default HighlightText;
