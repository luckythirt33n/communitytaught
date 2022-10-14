import passport from 'passport';
import validator from 'validator';
import mongoose from "mongoose";

import User from '../models/User.js';
import Token from '../models/Token.js';
import Lesson from '../models/Lesson.js';
import LessonProgress from '../models/LessonProgress.js';
import Homework from '../models/Homework.js';
import HomeworkItem from '../models/HomeworkItem.js';
import HomeworkExtra from '../models/HomeworkExtra.js';
import HomeworkProgress from '../models/HomeworkProgress.js';

import { unlinkGithub, unlinkGoogle } from '../routes/oauthRouter.js';

export const register = async (req, res) => {

	try {
		const validationErrors = [];
		if (!validator.isEmail(req.body.username)) validationErrors.push('Please enter a valid email address');
		if (validator.isEmpty(req.body.password)) validationErrors.push('Password cannot be blank');
		if (!validator.equals(req.body.password, req.body.confirm)) validationErrors.push('Passwords must match');
		if (validationErrors.length) {
			req.session.flash = { type: "error", message: validationErrors };
			return res.redirect('/register');
		}
		const user = new User({ username: req.body.username });
		await User.register(user, req.body.password);
		// // const lessons = await Lesson.find();
		// // for (let i = 0; i < lessons.length; i ++) {
		// // 	const progress = new LessonProgress({user: user._id, lesson: lessons[i]._id});
		// // 	await progress.save();
		// // }
		// const homework = await Homework.find().sort({_id: 1});
		// const items = await HomeworkItem.aggregate().group({ _id: "$homework", items: { $push: { item: "$_id" } } }).sort({_id: 1});
		// const extras = await HomeworkExtra.aggregate().group({ _id: "$homework", extras: { $push: { extra: "$_id", description: "$description" } } }).sort({_id: 1});
		// extras.forEach(extra => console.log(extra))
		// for (let i = 0; i < homework.length; i ++) {
		// 	const progress = new HomeworkProgress({user: user._id, homework: homework[i]._id});
		// 	for (let j = 0; j < items[i].items.length; j++) {
		// 		const item =  items[i].items[j];
		// 		progress.itemProgress.push({ _id: mongoose.Types.ObjectId(), item: item.item })
		// 	} 
		// 	for (let k = 0; k < extras[i].extras.length; k++) {
		// 		const extra =  extras[i].extras[k];
		// 		if (extra.description.length) {
		// 			progress.extraProgress.push({ _id: mongoose.Types.ObjectId(), extra: extra.extra });
		// 		}	
		// 	} 		
		// 	await progress.save();
		// }
		passport.authenticate('local')(req, res, function () {
			res.redirect('/email/verify');
		});

	} catch (err) {
		console.log(err)
		req.session.flash = { type: 'error', message: [err.message] };
		res.redirect('/register');
	}
};

export const login = (req, res, next) => {
	const validationErrors = [];
	if (!validator.isEmail(req.body.username)) validationErrors.push('Please enter a valid email address');
	if (validator.isEmpty(req.body.password)) validationErrors.push('Password cannot be blank');

	if (validationErrors.length) {
		req.session.flash = { type: "error", message: validationErrors };
		return res.redirect('/login');
	}
	req.body.username = validator.normalizeEmail(req.body.username, { gmail_remove_dots: false })

	passport.authenticate('local', (err, user, info) => {
		if (err) { return next(err) }
		if (!user) {
			req.session.flash = { type: "error", message: ["Invalid email or password"]};
			return res.redirect('/login');
		}
		req.logIn(user, (err) => {
			if (err) { return next(err) }
			res.redirect(req.session.returnTo || '/dashboard');
		})
	})(req, res, next)
}

export const logout = (req, res) => {
	req.logout(err => { 
		if (err) return next(err);
		res.redirect('/login');
	});
};

export const notLoggedIn = (req, res) => {
	req.session.flash = { type: "error", message: ["Please log in to continue."] };
	res.redirect('/login');
}

export const verify = async (req, res) => {
	try {
		if (!req.query.token) return res.redirect('/dashboard');
		const token = await Token.findOne({ token: req.query.token });
		if (!token) {
			req.session.flash = { type: "error", message: ["Invalid or expired link."]}
			return res.redirect('/dashboard');
		}
		const user = await User.findOne({ username: token.email });
		if (!user || user.username !== req.user.username) {
			req.session.flash = { type: "error", message: ["Invalid or expired link."]}
			return res.redirect('/dashboard');
		}
		user.verified = true;
		await user.save();
		await Token.findOneAndDelete({ token });
		req.session.flash = { type: "success", message: ["Your email has been verified."]}
		res.redirect('/dashboard');
	} catch (err) {
		console.log(err);
		req.session.flash = { type: "error", message: ["Verification error."]}
		res.redirect('/dashboard');
	}
}

export const reset = async (req, res) => {
	const validationErrors = [];
	const user = await User.findOne({ username: req.body.username });
	if (!user) {
		req.session.flash = { type: 'error', message: ['Invalid user.']};
		return res.redirect('/forgot');
	}
	if (validator.isEmpty(req.body.password)) validationErrors.push('Password cannot be blank');
	if (!validator.equals(req.body.password, req.body.confirm)) validationErrors.push('Passwords must match');
	if (validationErrors.length) {
		req.session.flash = { type: "error", message: validationErrors };
		return res.redirect(`/reset?token=${req.body.token}`);
	}
	await user.setPassword(req.body.password);
	user.hasPassword = true;
	await user.save();
	await Token.findOneAndDelete({ token: req.body.token })
	req.session.flash = { type: "success", message: ["Password changed successfully."]};
	res.redirect("/login");
}

export const changePassword = async (req, res) => {
	try {
		const validationErrors = [];
		const user = await User.findById(req.user._id);
		if (!user) {
			req.session.flash = { type: "error", message: ['Something went wrong. Please log in again.']};
			return res.redirect('/login');
		}
		if (validator.isEmpty(req.body.oldPassword)) validationErrors.push('Old password cannot be blank');
		if (validator.isEmpty(req.body.newPassword)) validationErrors.push('New password cannot be blank');
		if (validator.equals(req.body.newPassword, req.body.oldPassword)) validationErrors.push('New password must be different from old one');
		if (!validator.equals(req.body.newPassword, req.body.confirm)) validationErrors.push('New passwords must match');
		if (validationErrors.length) {
			req.session.flash = { type: "error", message: validationErrors };
			return res.redirect(`/account`);
		}
		await user.changePassword(req.body.oldPassword, req.body.newPassword);
		await user.save();
		req.logout(err => { 
			if (err) return next(err);
			req.session.flash = { type: "success", message: ['Password changed successfully. Please log in with new password']};
			res.redirect('/login');
		});
	} catch (err) {
		if (!err.message) err.message = "Something went wrong.";
		req.session.flash = { type: "error", message: [err.message]};
			return res.redirect('/account');
	}
}

export const setPassword = async (req, res) => {
	try {
		const validationErrors = [];
		const user = await User.findById(req.user._id);
		if (!user) {
			req.session.flash = { type: "error", message: ['Something went wrong. Please log in again.']};
			return res.redirect('/login');
		}
		if (validator.isEmpty(req.body.password)) validationErrors.push('Password cannot be blank');
		if (!validator.equals(req.body.password, req.body.confirm)) validationErrors.push('Passwords must match');
		if (validationErrors.length) {
			req.session.flash = { type: "error", message: validationErrors };
			return res.redirect(`/account`);
		}
		await user.setPassword(req.body.password);
		user.hasPassword = true;
		await user.save();
		req.session.flash = { type: "success", message: ['Password set successfully']};
		res.redirect('/account');
	} catch (err) {
		if (!err.message) err.message = "Something went wrong.";
		req.session.flash = { type: "error", message: [err.message]};
			return res.redirect('/account');
	}
}

export const changeEmail = async (req, res) => {
	try {
		const validationErrors = [];
		const user = await User.findById(req.user._id);
		if (!user) {
			req.session.flash = { type: "error", message: ['Something went wrong. Please log in again.']};
			return res.redirect('/login');
		}
		if (!validator.isEmail(req.body.username)) validationErrors.push('Please enter a valid email address');
		if (validationErrors.length) {
			req.session.flash = { type: "error", message: validationErrors };
			return res.redirect(`/account`);
		}
		user.username = req.body.username;
		user.verified = false;
		await user.save();
		req.logout(err => { 
			if (err) return next(err);
			req.session.flash = { type: "success", message: ['Email changed successfully. Please log in with new email']};
			res.redirect('/login');
		});
	} catch (err) {
		if (err.code === 11000) err.message = "This email address is registered with another account";
		if (!err.message) err.message = "Something went wrong.";
		req.session.flash = { type: "error", message: [err.message]};
			return res.redirect('/account');
	}
}


export const deleteAccount = async (req, res) => {
	try {
		unlinkGoogle(req);
		unlinkGithub(req);
		await User.findByIdAndDelete(req.user._id);
		req.session.flash = { type: "success", message: ['Your account has been deleted successfully']};	
		res.json('success');
	} catch (err) {
		if (!err.message) err.message = "Something went wrong.";
		req.session.flash = { type: "error", message: [err.message]};
		res.json('failure');
	}
}