export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  role: 'USER' | 'ADMIN';
  status: string;
  createdAt: string;
}
export type UserSummary = Pick<User, 'id' | 'username' | 'displayName'>;
export type PublicProfileUser = Pick<User, 'id' | 'username' | 'displayName' | 'bio' | 'createdAt'>;
export interface Product {
  id: string;
  sellerId: string;
  name: string;
  description: string;
  price: string;
  imagePath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  seller?: UserSummary;
}
export interface Message {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  status: string;
  createdAt: string;
  sender: { id: string; username: string; displayName: string };
}
export interface Room {
  id: string;
  type: 'GLOBAL' | 'DIRECT';
  members?: Array<{ user: UserSummary }>;
  messages?: Message[];
}
