import type { ReactNode } from 'react';
import { Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MENU_GROUPS, ROUTES, activeMenuPath, menuGroupOf, paths } from '../../routes';

/** Pages outside the menu: first path segment -> menu label. */
const UNLISTED: Record<string, 'cable' | 'port' | 'device' | 'panel'> = { cables: 'cable', ports: 'port', devices: 'device', panels: 'panel' };

/** Home / group / page / detail, derived from the route table only. */
export default function AppBreadcrumb() {
  const { pathname } = useLocation();
  const { t } = useTranslation('menu');
  const { t: tc } = useTranslation('common');
  const menuPath = activeMenuPath(pathname);
  const route = ROUTES.find((r) => r.path === menuPath);
  const group = MENU_GROUPS.find((g) => g.key === menuGroupOf(menuPath));

  const items: { key: string; title: ReactNode }[] = [
    { key: 'home', title: <Link to={paths.dashboard()} aria-label={t('dashboard')}><HomeOutlined /></Link> },
  ];
  if (pathname === paths.dashboard()) {
    items.push({ key: 'dashboard', title: t('dashboard') });
  } else {
    if (group) items.push({ key: group.key, title: t(group.labelKey) });
    if (route?.labelKey) {
      const leaf = pathname === route.path;
      items.push({ key: route.path, title: leaf ? t(route.labelKey) : <Link to={route.path}>{t(route.labelKey)}</Link> });
      if (!leaf) items.push({ key: 'detail', title: tc('breadcrumb.detail') });
    } else {
      const segs = pathname.split('/').filter(Boolean);
      const unlisted = UNLISTED[segs[0] ?? ''];
      items.push({ key: 'page', title: unlisted ? t(unlisted) : tc('breadcrumb.page') });
      if (unlisted && segs.length > 1) items.push({ key: 'detail', title: tc('breadcrumb.detail') });
    }
  }
  return <Breadcrumb className="app-breadcrumb" items={items} />;
}
