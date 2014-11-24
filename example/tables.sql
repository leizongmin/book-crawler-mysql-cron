--
-- 数据库: `sina_blog`
--

-- --------------------------------------------------------

--
-- 表的结构 `article_detail`
--

CREATE TABLE IF NOT EXISTS `article_detail` (
  `id` varchar(20) NOT NULL,
  `tags` text NOT NULL,
  `content` longtext NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- 表的结构 `article_list`
--

CREATE TABLE IF NOT EXISTS `article_list` (
  `id` varchar(20) NOT NULL,
  `title` varchar(255) NOT NULL,
  `url` text NOT NULL,
  `class_id` int(11) NOT NULL,
  `created_time` int(11) NOT NULL,
  PRIMARY KEY (`id`,`class_id`),
  KEY `created_time` (`created_time`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- 表的结构 `article_tag`
--

CREATE TABLE IF NOT EXISTS `article_tag` (
  `id` varchar(20) NOT NULL,
  `tag` varchar(20) NOT NULL,
  PRIMARY KEY (`id`,`tag`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- 表的结构 `class_list`
--

CREATE TABLE IF NOT EXISTS `class_list` (
  `id` int(11) NOT NULL,
  `url` varchar(255) NOT NULL,
  `name` varchar(50) NOT NULL,
  `count` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;
