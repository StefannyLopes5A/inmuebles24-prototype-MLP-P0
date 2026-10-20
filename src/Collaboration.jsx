import React from 'react';
import {AVATAR_SRC} from './Account';
import {useLanguage} from './i18n';

export function useSay() {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  return {language, say:(es, br) => pt ? br : es};
}

export const REACTION_LABELS = {
  like:{es:'Me gusta', br:'Gostei'},
  doubt:{es:'Tengo dudas', br:'Tenho dúvidas'},
  no:{es:'No me convence', br:'Não me convence'},
};
export const reactionLabel = (kind, say) => say(REACTION_LABELS[kind].es, REACTION_LABELS[kind].br);

const TONES = ['#f3d9c9', '#d6e4f0', '#dcebd5', '#efe0f3', '#f6e7b8', '#e0e0e0'];
const tone = name => TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TONES.length];

/** Display name and initial only; the prototype persona keeps the account photo. */
export function MemberAvatar({name, left = false, self = false, size = 28, title}) {
  const label = title ?? name;
  const style = {width:size, height:size, fontSize:Math.round(size * 0.42)};
  if (!name) return <span className="member-avatar is-guest" style={style} title={label} data-left={left || undefined}>?</span>;
  if (self || name === 'Alex') return <span className="member-avatar" style={style} title={label} data-left={left || undefined}><img src={AVATAR_SRC} alt=""/></span>;
  return <span className="member-avatar" style={{...style, background:tone(name)}} title={label} data-left={left || undefined}>{name.slice(0, 1).toUpperCase()}</span>;
}

/**
 * The folder's people in one pill: alone it reads "add someone" (+), with company it opens the list (›).
 * The pill widens with each face, so the list visibly has room for more.
 */
export function MembersChip({members, label, onClick}) {
  const alone = members.length < 2;
  return <button type="button" className="members-chip" onClick={onClick} aria-label={label} title={label} data-alone={alone || undefined}>
    {members.length > 0 && <AvatarStack members={members} size={32} max={4}/>}
    <span className="members-chip-icon" aria-hidden="true">
      {alone
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>}
    </span>
  </button>;
}

/** Up to three faces and a "+N" from the fourth. */
export function AvatarStack({members, size = 28, max = 3, label}) {
  const shown = members.slice(0, max), extra = members.length - shown.length;
  return <span className="avatar-stack" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {shown.map(member => <MemberAvatar key={member.id} name={member.name} left={member.left} self={member.self} size={size}/>)}
    {extra > 0 && <span className="member-avatar is-more" style={{width:size, height:size, fontSize:Math.round(size * 0.38)}}>+{extra}</span>}
  </span>;
}
