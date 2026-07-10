import React, { useMemo } from 'react';
import {
	ArrowLeft,
	BadgeCheck,
	Github,
	Instagram,
	Linkedin,
	MapPin,
	Star,
	Twitter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProfileSphereAvatar from '../components/ProfileSphereAvatar';

const getJoinDate = (user) => {
	const candidates = [user?.createdAt, user?.created_at];

	for (const candidate of candidates) {
		if (!candidate) continue;
		const parsed = new Date(candidate);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}

	return null;
};

const getProfileCategory = (user) => {
	const occupation = String(user?.occupation || '').toLowerCase();
	const education = String(user?.education || '').toLowerCase();

	if (/(professor|teacher|lecturer|faculty|instructor)/.test(occupation)) {
		return 'Professor';
	}

	if (/(student|learner|scholar|intern|undergrad|postgrad|research)/.test(`${occupation} ${education}`)) {
		return 'Student';
	}

	return 'Learner';
};

const getAchievementScore = (user) => {
	const currentStreak = Number(user?.currentStreak || 0);
	const longestStreak = Number(user?.longestStreak || 0);
	const totalStudyDays = Number(user?.totalStudyDays || 0);
	return currentStreak + longestStreak + totalStudyDays;
};

const getLocationQuery = (user) => {
	const query = String(user?.location || '').trim();
	return query || 'India';
};

const ProfileV2 = () => {
	const navigate = useNavigate();
	const { user } = useAuth();

	const joinDate = getJoinDate(user);
	const category = getProfileCategory(user);
	const achievementScore = getAchievementScore(user);
	const memScore = Number(user?.memScore || 0);
	const hobbies = useMemo(
		() => String(user?.interests || '')
			.split(/[,;\n]/)
			.map((item) => item.trim())
			.filter(Boolean),
		[user?.interests]
	);
	const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(getLocationQuery(user))}&z=12&output=embed`;
	const memberSince = joinDate ? String(joinDate.getFullYear()) : '—';

	return (
		<div className="min-h-screen bg-[#050505] text-white">
			<section className="relative left-1/2 w-screen -translate-x-1/2">
				<div className="relative h-[20vh] min-h-[180px] max-h-[250px] w-full overflow-hidden">
					<img src="/banner.png" alt="Profile banner" className="h-full w-full object-cover object-center" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/20 to-black/65" />
					<button
						type="button"
						onClick={() => navigate(-1)}
						className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full bg-black/55 p-2.5 text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-black/75"
						aria-label="Go back"
						title="Go back"
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
				</div>
			</section>

			<div className="mx-auto max-w-[1500px] px-6 pb-10 sm:px-10 lg:px-16">
				<div className="-mt-14 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:pl-5">
					<aside className="space-y-5">
						<section className="rounded-[18px] bg-[#0d0d10]/88 p-5 shadow-[0_22px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
							<div className="flex items-start gap-4">
								<div className="shrink-0 rounded-[16px] bg-white/[0.03] p-1">
									<ProfileSphereAvatar
										iconId={user?.profileIconId || 'sphere-1'}
										username={user?.username || user?.email?.split('@')[0] || 'User'}
										size="xl"
									/>
								</div>

								<div className="min-w-0 flex-1 pt-1">
									<h1 className="truncate text-[2rem] font-semibold tracking-tight text-white">
										{user?.username || user?.email?.split('@')[0] || 'User'}
									</h1>
									<div className="mt-1 text-sm text-white/50">
										@{String(user?.username || user?.email?.split('@')[0] || 'user').toLowerCase()}
									</div>

									<div className="mt-4 flex items-center gap-2">
										<button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08]" aria-label="Instagram"><Instagram className="h-4 w-4" /></button>
										<button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08]" aria-label="Twitter"><Twitter className="h-4 w-4" /></button>
										<button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08]" aria-label="LinkedIn"><Linkedin className="h-4 w-4" /></button>
										<button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08]" aria-label="GitHub"><Github className="h-4 w-4" /></button>
									</div>
								</div>
							</div>

							<div className="mt-5 grid grid-cols-2 gap-3 text-sm">
								<div className="rounded-[14px] bg-white/[0.03] p-3">
									<div className="text-[11px] uppercase tracking-[0.22em] text-white/38">Category</div>
									<div className="mt-1 text-white/90">{category}</div>
								</div>
								<div className="rounded-[14px] bg-white/[0.03] p-3">
									<div className="text-[11px] uppercase tracking-[0.22em] text-white/38">Stars</div>
									<div className="mt-1 inline-flex items-center gap-1 text-white/90"><Star className="h-4 w-4 text-amber-300" /><span>{achievementScore}</span></div>
								</div>
								<div className="rounded-[14px] bg-white/[0.03] p-3">
									<div className="text-[11px] uppercase tracking-[0.22em] text-white/38">Member since</div>
									<div className="mt-1 text-white/90">{memberSince}</div>
								</div>
								<div className="rounded-[14px] bg-white/[0.03] p-3">
									<div className="text-[11px] uppercase tracking-[0.22em] text-white/38">MemScore</div>
									<div className="mt-1 text-white/90">{memScore.toFixed(1)}</div>
								</div>
							</div>

							<div className="mt-5 flex gap-3">
								<button type="button" className="flex-1 rounded-[14px] bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/84 transition-colors hover:bg-white/[0.08]">Get In Touch</button>
								<button type="button" onClick={() => navigate('/profile')} className="flex-1 rounded-[14px] bg-[#ffd633] px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#ffe04d]">Edit Details</button>
							</div>
						</section>

						<section className="rounded-[18px] bg-[#0d0d10]/82 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
							<div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/90"><BadgeCheck className="h-4 w-4 text-amber-300" />Achievements</div>
							<div className="flex flex-wrap gap-2">
								{[
									{ label: 'Consistency', value: user?.currentStreak || 0 },
									{ label: 'Milestones', value: user?.longestStreak || 0 },
									{ label: 'Study Days', value: user?.totalStudyDays || 0 },
									{ label: 'MemScore', value: memScore.toFixed(1) }
								].map((item) => (
									<span key={item.label} className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/74">
										<span className="h-2 w-2 rounded-full bg-amber-300" />
										{item.label} {item.value}
									</span>
								))}
							</div>
						</section>

						<section className="rounded-[18px] bg-[#0d0d10]/82 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
							<div className="mb-3 text-sm font-medium text-white/90">Hobbies</div>
							<div className="flex flex-wrap gap-2">
								{hobbies.length > 0 ? hobbies.map((item) => (
									<span key={item} className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/74">{item}</span>
								)) : <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">No hobbies yet</span>}
							</div>
						</section>

						<section className="rounded-[18px] bg-[#0d0d10]/82 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
							<div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/90"><MapPin className="h-4 w-4 text-emerald-300" />Location</div>
							<div className="overflow-hidden rounded-[14px] bg-black/20">
								<iframe title="Profile location map" src={mapSrc} className="h-[220px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
							</div>
						</section>
					</aside>

					<section className="hidden min-h-[900px] rounded-[20px] bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.06),transparent_35%),#070708] lg:block" />
				</div>
			</div>
		</div>
	);
};

export default ProfileV2;
