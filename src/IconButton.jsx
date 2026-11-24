import React from 'react';
import {Icon} from './App';

/**
 * The round action button: close, back, arrows, clear, share, zoom. Always 40×40 with a 16 px icon,
 * so a new one never picks its own size. `icon` names a glyph from `Icon`; `children` takes a custom glyph.
 * Position and spacing stay with the caller's `className`.
 */
export const IconButton = React.forwardRef(function IconButton({icon, label, variant = 'solid', className = '', type = 'button', children, ...rest}, ref) {
  return <button ref={ref} type={type} className={`icon-btn icon-btn--${variant}${className ? ` ${className}` : ''}`} aria-label={label} {...rest}>
    {children ?? <Icon name={icon} size={16}/>}
  </button>;
});
