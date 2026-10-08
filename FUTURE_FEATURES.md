# FUNAAB Life — Post-Beta Roadmap & Future Features

## Postponed Feature: Hostel Room Personalization & Furniture Decoration
*Status: Explicitly Postponed during Public Beta Stabilization Pass*

### Student Feedback & Feature Proposal:
Students have requested the ability to:
1. Own or rent personal hostel rooms in Iyalode, Umar Kabir, or Private Off-Campus lodges.
2. Purchase dorm items, electronics, bedding, study desks, and wall posters from campus vendors (using earned Naira).
3. Decorate and customize room layouts with 3D grid placement.
4. Invite friends and study groups over to private dorm rooms with spatial audio & social interactions.

### Core Architecture Blueprint (Planned for Future Milestone):
- **Database Schema**:
  - `hostel_rooms` table (`room_id`, `owner_user_id`, `dorm_complex`, `room_number`, `is_locked`)
  - `user_furniture_inventory` table (`user_id`, `item_id`, `quantity`, `placed_room_id`)
  - `room_placed_items` table (`room_id`, `item_id`, `position_x`, `position_y`, `position_z`, `rotation_y`)
- **Gameplay Economy Loop**:
  - Attend lectures / do campus jobs -> Earn ₦ -> Buy furniture from campus shop -> Customize hostel -> Socialize.
- **Safety & Permissions**:
  - Room privacy toggles (Public, Friends Only, Locked).
  - Moderation filters for room names and custom signs.
