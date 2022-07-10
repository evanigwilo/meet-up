// 👇 Typeorm
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
// 👇 Entities
import Conversation from '../entity/Conversation';
// 👇 Services
import pubsub from '../services/pubsub';
// 👇 Constants, Helpers & Types
import { Conversations } from '../types';
import { Publish } from '../types/enum';

@EventSubscriber()
export class ConversationSubscriber implements EntitySubscriberInterface<Conversation> {
  listenTo() {
    return Conversation;
  }

  async publishConversations(event: InsertEvent<Conversation> | UpdateEvent<Conversation>) {
    const conversation = event.entity as Conversation;

    // 👇 if swapping column to match last sender
    if (conversation.seen === undefined) {
      return;
    }

    // 👇 get count of all unseen conversations
    const unseen = await event.manager.count(Conversation, {
      relations: {
        to: true,
      },
      where: { to: { id: conversation.to.id }, seen: false },
    });

    const publish: Partial<Conversations> = {
      from: conversation.from.id,
      to: conversation.to.id,
      unseen,
      update: conversation.seen,
    };
    // 👇 publish conversations notification
    pubsub
      .publish(Publish.CONVERSATIONS, { conversations: publish })

      .catch(() => {});
  }

  async afterInsert(event: InsertEvent<Conversation>) {
    await this.publishConversations(event);
  }

  async afterUpdate(event: UpdateEvent<Conversation>) {
    await this.publishConversations(event);
  }
}
