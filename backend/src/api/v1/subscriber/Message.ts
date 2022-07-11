// 👇 Typeorm
import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from 'typeorm';
// 👇 Entities
import Conversation from '../entity/Conversation';
import Message from '../entity/Message';
// 👇 Services
import pubsub from '../services/pubsub';
// 👇 Constants, Helpers & Types
import { MessageType, Publish } from '../types/enum';

@EventSubscriber()
export class MessageSubscriber implements EntitySubscriberInterface<Message> {
  listenTo() {
    return Message;
  }

  async afterInsert(event: InsertEvent<Message>) {
    const message = event.entity;

    message.type = message.missed ? MessageType.MISSED_CALL : MessageType.NEW_MESSAGE;

    const conversation = new Conversation({
      from: message.from,
      to: message.to,
      message: {
        id: message.id,
      },
      seen: false,
    });

    // 👇 new message or missed call
    pubsub
      .publish(Publish.MESSAGE, {
        [Publish.MESSAGE]: message,
      })
      .catch(() => {});

    // 👇 swap column to match last sender
    await event.manager.update(
      Conversation,
      { from: conversation.to, to: conversation.from },
      { from: conversation.from, to: conversation.to },
    );

    // 👇 upsert conversation
    await event.manager
      .createQueryBuilder()
      .insert()
      .into(Conversation)
      .values(conversation)
      .orUpdate(['message', 'seen'], ['from', 'to'], {
        skipUpdateIfNoValuesChanged: true,
      })
      .execute();

    /*
    const builder = event.manager.createQueryBuilder().insert().into(Conversation).values(conversation);
    const [query, params] = builder.getQueryAndParameters(); 
    
    ON CONFLICT ( "from", "to" ) DO UPDATE SET "message" = EXCLUDED."message"  WHERE ("conversations"."message" IS DISTINCT FROM EXCLUDED."message")  
    ON CONFLICT ( "from", "to" ) DO UPDATE SET "name" = CASE WHEN books.is_locked THEN books.name ELSE excluded.name END`;

    const execute = await event.manager.query(query, params);
    console.log({ query, params, execute });

    */
  }
  async afterUpdate(event: UpdateEvent<Message>) {
    const message = event.entity as Message;

    if (message.deleted) {
      // 👇 deleted message
      message.type = MessageType.DELETED_MESSAGE;
      pubsub
        .publish(Publish.MESSAGE, {
          [Publish.MESSAGE]: message,
        })
        .catch(() => {});
    }
  }
}
